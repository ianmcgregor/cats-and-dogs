/* main.js */

(function() {

    'use strict';

    var game,
        width = 800,
        height = 480,
        mapWidth,
        mapHeight,
        levelContainer,
        tileset,
        layer,
        layerData,
        hero,
        cursors,
        fishes,
        score = 0,
        scoreText,
        gun,
        heroHasGun = false,
        bullets,
        enemies,
        enemyAddedAt = 0,
        enemyVelocity = 100,
        heroHealth = 100,
        shotAt = 0,
        hurtAt = 0,
        exploder,
        level,
        jumpedAt = 0,
        paw,
        pawTween,
        levels;

    levels = [
        {
            id: 'level1',
            startX: 128,
            startY: 100
        },
        {
            id: 'boss1',
            startX: 500,
            startY: 0
        }
    ];

    game = new Phaser.Game(width, height, Phaser.AUTO, '', { preload: preload, create: create, update: update });

    function preload() {
        game.load.tilemap('level1', 'assets/level1.json', null, Phaser.Tilemap.TILED_JSON);
        game.load.tilemap('boss1', 'assets/boss1.json', null, Phaser.Tilemap.TILED_JSON);
        game.load.tileset('tileset', 'assets/tiles.png', 64, 64);
        game.load.atlasJSONHash('entities', 'assets/entities.png', 'assets/entities.json');
    }

    function create() {
        game.input.maxPointers = 1;
        game.stage.scaleMode = Phaser.StageScaleMode.SHOW_ALL;
        game.stage.scale.minWidth = width / 2;
        game.stage.scale.minHeight = height / 2;
        game.stage.scale.maxWidth = width * 2;
        game.stage.scale.maxHeight = height * 2;
        game.stage.scale.forceLandscape = true;
        game.stage.scale.pageAlignHorizontally = true;
        game.stage.scale.setScreenSize(true);
        game.stage.backgroundColor = '#7a94ff';

        // tileset
        tileset = game.add.tileset('tileset');
        // set all collidable initially
        tileset.setCollisionRange(0, tileset.total - 1, true, true, true, true);
        // water
        tileset.setCollisionRange(5, 7, false, false, false, false);
        tileset.setCollisionRange(9, 11, false, false, false, false);
        //  one-way
        tileset.setCollision(15, true, false, false, false);
        
        // level map
        levelContainer = game.add.group();
        level = levels[0];
        addTileMap(level.id);

        // fish
        fishes = game.add.group();
        for(var i = 0; i < layerData.length; i++) {
            for(var j = 0; j < layerData[i].length; j++) {
                if(layerData[i][j] === 11 && Math.random() > 0.4) {
                    var fish = fishes.create(j * 64, i * 64, 'entities', 'fish');
                    fish.body.gravity.y = 8;
                }
            }
        }

        // hero
        hero = game.add.sprite(width / 2, 0, 'entities', 'hero_1');
        //hero.body.setSize(48, 40, 8, 20);
        hero.body.bounce.y = 0.2;
        hero.body.gravity.y = 10;
        hero.body.gravity.x = 0;
        hero.body.collideWorldBounds = false;
        hero.events.onOutOfBounds.add(function(hero) {
            //hero.kill();
            if(hero.y < 0) {
                return;
            }
            restart();
        });
        hero.anchor.setTo(0.5, 0.5);
        hero.animations.add('walk', ['hero_1', 'hero_2'], 8, true);
        // camera to follow hero
        game.camera.follow(hero);
        
        // gun
        gun = game.add.sprite(600, 400, 'entities', 'gun');
        gun.anchor.setTo(0.5, 1);
        bullets = game.add.group();

        // enemies
        enemies = game.add.group();

        // explosion
        exploder = game.add.emitter(0, 0, 100);
        exploder.makeParticles('entities', 'blood');

        // controls
        game.input.keyboard.addKeyCapture([ Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN, Phaser.Keyboard.SPACEBAR ]);
        cursors = game.input.keyboard.createCursorKeys();

        // hud
        scoreText = game.add.text(16, 16, 'score: 0', { fontSize: '28px', fill: '#000' });
    }

    function update() {
        // keep hud positioned top left
        scoreText.x = game.camera.x + 16;
        scoreText.y = game.camera.y + 16;
        
        // collide the hero with the map
        game.physics.collide(hero, layer, function(h, t) {
            //console.log('t', t);
            switch(t.tile.index) {
                //case 1:
                //    restart();
                //    break;
                case 1:
                case 2:
                    nextLevel();
                    break;
            }
        });

        // enemies
        if(enemies.length > 0) {
            game.physics.collide(enemies, layer);
            game.physics.collide(hero, enemies, function(h, e) {
                var landedOnHead = h.body.touching.down && e.body.touching.up;
                if(landedOnHead) {
                    killEnemy(e);
                }
                else if(game.time.now - hurtAt > 200) {
                    heroHealth --;
                    hurtAt = game.time.now;
                    updateText();
                }
            });

            enemies.forEach(function(enemy) {
                if(enemy.body.velocity.x === 0 && enemy.body.touching.down) {
                    enemy.body.velocity.x = enemy.x < hero.x ? enemyVelocity : -enemyVelocity;
                    enemy.scale.x = enemy.body.velocity.x > 0 ? 1 : -1;
                    enemy.animations.play('walk');
                }
                if(enemy.body.velocity.y < 1 && ( enemy.body.touching.left || enemy.body.touching.right ) ) {
                    enemy.body.velocity.y = -400;
                    enemy.body.velocity.x = enemy.scale.x > 0 ? enemyVelocity : -enemyVelocity;
                }
            });

            if(bullets.length > 0) {
                game.physics.collide(bullets, enemies, function(bullet, enemy) {
                    bullet.kill();
                    killEnemy(enemy);
                });
            }
        }

        // fishes
        fishes.forEach(function(fish) {
            fish.body.velocity.x = 0;
            if(fish.y > 640) {
                fish.body.velocity.y = -600 + ( -100 * Math.random() );
            }
        });
        game.physics.collide(fishes, hero);

        // hero movement
        hero.body.velocity.x = 0;

        if (cursors.left.isDown) {
            hero.body.velocity.x = -150;
            hero.scale.x = -1;
        }
        else if (cursors.right.isDown) {
            hero.body.velocity.x = 150;
            hero.scale.x = 1;
        }
        //  jump
        if (cursors.up.isDown && hero.body.touching.down) {
            hero.body.velocity.y = -300;
            jumpedAt = game.time.now;
        }
        else if (cursors.up.isDown && hero.body.velocity.y < 0 && hero.body.velocity.y > -600 && game.time.now - jumpedAt < 200) {
            hero.body.velocity.y = hero.body.velocity.y - 40;
        }
        // animation
        if(Math.abs(hero.body.velocity.x) > 0 && hero.body.touching.down) {
            hero.animations.play('walk');
        }
        else {
            hero.animations.stop(); 
            hero.frame = 'hero_1';
        }
        
        // get gun
        game.physics.overlap(hero, gun, function() {
            heroHasGun = true;
        });

        // shoot
        if(heroHasGun) {
            gun.x = hero.x;
            if(hero.scale.x < 0) {
                gun.x -= 32;
            }
            gun.y = hero.y;
            gun.scale.x = hero.scale.x;

            if(game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR) && game.time.now - shotAt > 200 ) {
                var b = bullets.create(hero.scale.x > 0 ? gun.x + 36 : gun.x - 36, gun.y - 40, 'entities', 'bullet');
                b.body.velocity.x = hero.scale.x > 0 ? 600 : -600;
                b.events.onOutOfBounds.add(function(bullet) {
                    bullet.kill();
                });
                shotAt = game.time.now;
            }
        }

        // update level
        updateLevel();
    }

    function updateLevel() {
       switch(level.id) {
            case 'level1':
                 if(Math.random() > 0.5 && enemies.length < 25 && game.time.now - enemyAddedAt > 5000) {
                    addEnemy();
                    enemyAddedAt = game.time.now;
                }
                break;
            case 'boss1':
                if(!paw) {
                    paw = game.add.sprite(mapWidth, mapHeight - 256, 'entities', 'paw');
                    pawTween = game.add.tween(paw);
                }
                if(paw.x === mapWidth && Math.random() > 0.8) {
                    pawTween.stop();
                    paw.y = mapHeight - 220 + Math.random() * 200;
                    var xMin = 128;
                    var xTo = xMin + Math.random() * 400;
                    var xToHover = xTo - 200 + Math.random() * 400;
                    if(xToHover < xMin) {
                        xToHover = xMin;
                    }
                    pawTween = game.add.tween(paw);
                    pawTween
                        .to({ x: xTo }, 2000 + Math.random() * 1000, Phaser.Easing.Elastic.Out)
                        .to({ x: xToHover }, 500 + Math.random() * 1000, Phaser.Easing.Linear.None)
                        .to({ x: mapWidth }, 2500, Phaser.Easing.Linear.None)
                        .start();
                }
                break; 
       }
    }

    function updateText() { 
        scoreText.content = 'Score: ' + score + ' Health: ' + heroHealth;
    }
    /*
    function createFish() {
        for (var i = 0; i < 100; i++) {
            var fish = fishes.create(i * 200 + Math.random() * 200, 0, 'fish');
            fish.body.gravity.y = 6;
            fish.body.bounce.y = 0.7 + Math.random() * 0.2;
        }
    }
    */
    function addEnemy() {
        //console.log('addEnemy', game.camera);
        var enemyType = Math.random() < 0.5 ? 'dog' : 'cat';
        var enemy = enemies.create(game.camera.x + ( game.camera.view.width * Math.random()), 0 - 64, 'entities', enemyType + '_1');
        enemy.body.bounce.y = 0.2;
        enemy.body.gravity.y = 8;
        enemy.body.gravity.x = 0;
        enemy.anchor.setTo(0.5, 0.5);
        enemy.animations.add('walk', [enemyType + '_1', enemyType + '_2'], 3, true);
        enemy.body.collideWorldBounds = false;
        enemy.events.onOutOfBounds.add(function(e) {
            if(e.y > 0) {
                e.kill();
            }
        });
    }

    function killEnemy(e) {
        exploder.x = e.x;
        exploder.y = e.y;
        exploder.start(true, 500, null, 20);
        e.kill();
    }

    function addTileMap(level) {
        if(layer) {
            layer.kill();
        }
        var map = game.add.tilemap(level);
        layerData = map.layers[0].data;
        mapWidth = map.layers[0].width * tileset.tileWidth;
        mapHeight = map.layers[0].height * tileset.tileHeight;
        layer = new Phaser.TilemapLayer(game, 0, 0, mapWidth, mapHeight, tileset, map, 0);
        //layer = game.add.tilemapLayer(0, 0, mapWidth, mapHeight, tileset, map, 0);
        layer.fixedToCamera = false;
        levelContainer.add(layer);
        layer.resizeWorld();
    }

    function restart() {
        console.log('RESTART');
        hero.x = level.startX;
        hero.y = level.startY;
        game.camera.x = 0;
        game.camera.y = 0;
    }

    function nextLevel() {
        console.log('NEXT LEVEL');
        var i = levels.indexOf(level);
        i++;
        if(i > levels.length - 1) {
            i = 0;
        }
        level = levels[i];

        fishes.removeAll();
        enemies.removeAll();

        addTileMap(level.id);
        restart();
    }

})();