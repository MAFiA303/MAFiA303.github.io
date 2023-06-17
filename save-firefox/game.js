// Variables for the game
var score = 0;
var scorePerClick = 1;
var upgradeCost = 10;
var cookieSize = 100;
var cookieScore = 1;  // Start at 1 and double this each time a new cookie is spawned
var cookies = [];
var upgrades = 0;
var timeToBeat = localStorage.getItem('timeToBeat');
var maxUpgrades = 10;  // Set the maximum number of upgrades


document.getElementById('start-game').addEventListener('click', function() {
    document.getElementById('modal-start').style.display = 'none';
    

    // Start your game logic here...

    // if (timeToBeat) {
    //     alert('Time to beat: ' + timeToBeat + ' seconds');
    // }
    // Get DOM elements
    var scoreSpan = document.getElementById('score');
    var upgradeCostSpan = document.getElementById('upgrade-cost');
    var cookieButton = document.getElementById('cookie-button');
    var clickSound = document.getElementById('click-sound');
    var upgradesLeftSpan = document.getElementById('upgrades-left'); 

    // Click event for the main cookie button
    cookieButton.addEventListener('click', function() {
        score += 1;  // Always add 1 for the main cookie button
        scoreSpan.innerText = score;
    });
    
    document.getElementById('upgrade-button').addEventListener('click', function() {
        if (score >= upgradeCost) {
            score -= upgradeCost;
            upgrades++;
            scoreSpan.innerText = score;
            scorePerClick *= 2;
            upgradeCost *= 2;
            upgradeCostSpan.innerText = upgradeCost;
            cookieSize *= 0.7;  // Smaller cookies faster
            cookieScore *= 2;   // Higher score
            spawnCookie(cookieScore, cookieSize);  // Spawn a cookie with the new score and size
            spawnMonster();
    
            // Update the falling cookies
            for (var i = 0; i < fallingCookies.length; i++) {
                var cookie = fallingCookies[i];
                cookie.stopFalling();
                cookie.startFalling(0, 5 - upgrades * 0.4, 50 - upgrades * 4);
                if (upgrades > 4) {
                    cookie.cookie.addEventListener('click', function() {
                        score = 0;
                        scoreSpan.innerText = score;
                    });
                    cookie.cookie.addEventListener('mousemove', function(e) {
                        this.style.left = e.clientX + 'px';
                        this.style.top = e.clientY + 'px';
                    });
                }
            }
            upgradesLeftSpan.innerText =maxUpgrades - upgrades + " upgrades remaining";  // Update the innerText of the upgrades left span       

            if (upgrades >= maxUpgrades) {
                var endTime = Date.now();
                var totalTime = ((endTime - startTime) / 1000).toFixed(2);
                localStorage.setItem('topScore', totalTime);
                congratsScreen.style.display = 'block';  // Show the congratulations screen
    
                var congratsMessage = document.getElementById('congrats-message');
                congratsMessage.innerText = 'Congratulations, you won! Your time was ' + totalTime + ' seconds. Top Score: ' + totalTime;
    
                var resetButton = document.createElement("button");
                resetButton.innerHTML = "Start New Game";
                resetButton.addEventListener('click', function() {
                    location.reload();
                });
                congratsScreen.appendChild(resetButton);
            }
        } else {
            score = 0;
            scoreSpan.innerText = score;
            alert("Not enough users for an upgrade, you lost all users!");
        }
    });
    
    


    
    // Function to move the cookie button
    function moveCookieButton() {
        var x = Math.random() * (window.innerWidth - cookieButton.offsetWidth);
        var y = Math.random() * (window.innerHeight - cookieButton.offsetHeight);
        cookieButton.style.left = x + 'px';
        cookieButton.style.top = y + 'px';
        setTimeout(moveCookieButton, Math.random() * 7000 + 7000);
    }
    
    // Play sound when cookie button is clicked
    cookieButton.addEventListener('click', function() {
        clickSound.play();
    });
    
    // Function to create a cookie or decoy
    function createCookie(cookieScore, size, isDecoy = Math.random() > 0.8) {  // 20% chance to create a decoy
        var cookie = document.createElement('div');
        cookie.classList.add('cookie');
        cookie.style.width = size + 'px';
        cookie.style.height = size + 'px';
    
        if (isDecoy) {
            // Randomly select a decoy image
            var decoyImageNumber = Math.floor(Math.random() * 2) + 1;
            var decoyImage = 'url("assets/images/decoy-' + decoyImageNumber + '.png")';
            cookie.style.backgroundImage = decoyImage;
    
            cookie.addEventListener('click', function() {
                score = 0;
                scoreSpan.innerText = score;
            });
        } else {
            cookie.style.backgroundImage = 'url("assets/images/cookie.png")';
    
            cookie.addEventListener('click', function() {
                score += cookieScore;
                scoreSpan.innerText = score;
            });
        }
        return cookie;
    }
    
    // Function to spawn a cookie
    function spawnCookie(cookieScore, size) {
        var cookie = createCookie(cookieScore, size);
        cookies.push(cookie);
        document.body.appendChild(cookie);
        moveElementToRandomPosition(cookie);
        setInterval(function() {
            moveElementToRandomPosition(cookie);
        }, Math.random() * 20000 + 10000);
    }
    
    // Function to despawn a cookie
    function despawnCookie() {
        if (cookies.length > 1) {
            var index = Math.floor(Math.random() * cookies.length);
            var cookie = cookies[index];
            document.body.removeChild(cookie);
            cookies.splice(index, 1);
        }
    }
    
    // Function to spawn a monster
    // Function to spawn a monster
    function spawnMonster() {
        var monster = document.createElement('div');
        monster.classList.add('monster');
    
        // Randomly select a monster image
        var monsterImageNumber = Math.floor(Math.random() * 4) + 1;
        var monsterImage = 'url("assets/images/monster-' + monsterImageNumber + '.png")';
        monster.style.backgroundImage = monsterImage;
    
        monster.style.width = '100px'; // Set monster's size
        monster.style.height = '100px';
        document.body.appendChild(monster);
        moveElementToRandomPosition(monster);
        setInterval(function() {
            moveElementToRandomPosition(monster);
        }, Math.random() * 5000 + 5000);
        monster.addEventListener('click', function() {
            // You might want to do more than just alert the player when they lose!
            alert('Game over! You clicked on a monster!');
            location.reload();  // Reload the page to reset the game
        });
    }
    
    
    // Function to randomly position an element
    function moveElementToRandomPosition(element) {
        var x = Math.random() * (window.innerWidth - element.offsetWidth);
        var y = Math.random() * (window.innerHeight - element.offsetHeight);
        element.style.left = x + 'px';
        element.style.top = y + 'px';
    }
    
    // Move the cookie button to an initial random position
    moveCookieButton();
    
    // Spawn cookies periodically
    setInterval(function() {
        spawnCookie(cookieScore, cookieSize);
    }, Math.random() * 30000 + 30000);
    
    // Despawn cookies periodically, but not more often than they spawn
    setInterval(despawnCookie, Math.random() * 60000 + 60000);
    
    setInterval(spawnMonster, Math.random() * 30000 + 30000);
    
    // Timer
    var timerElement = document.getElementById('timer');
    var startTime = Date.now();
    
    setInterval(function() {
        var elapsedTime = Date.now() - startTime;
        // Convert milliseconds to seconds, and keep two decimal places
        var seconds = (elapsedTime / 1000).toFixed(2);
        timerElement.innerText = seconds + ' seconds';
    }, 1);  // Update the timer every millisecond
    
    
    // Variables for the game
    // ...
    var topScoreSpan = document.getElementById('top-score');
    var congratsScreen = document.getElementById('congratulations');
    var topScore = localStorage.getItem('topScore');
    
    if (topScore) {
        topScoreSpan.innerText = 'Top Score: ' + topScore;
    }

    
    function spawnFallingCookie(id, delay) {
        var cookie = document.createElement('div');
        cookie.id = id;
        cookie.className = 'falling-cookie';
        document.body.appendChild(cookie);
        setTimeout(function() {
            cookie.style.animation = 'fall 5s linear infinite';
        }, delay);
    }
    
    for (var i = 1; i <= 11; i++) {
        spawnFallingCookie('falling-cookie-' + i, i * 1500);
    }
    
    
    // Variables for the game
    // ...
    var topScoreSpan = document.getElementById('top-score');
    var congratsScreen = document.getElementById('congratulations');
    var topScore = localStorage.getItem('topScore');
    
    if (topScore) {
        topScoreSpan.innerText = 'Top Score: ' + topScore;
    }
    
    // ...
    
    
    class FallingCookie {
        constructor(id) {
            this.id = id;
            this.cookie = document.createElement('div');
            this.cookie.id = id;
            this.cookie.className = 'falling-cookie';
            document.body.appendChild(this.cookie);
    
            this.clientX = 0;
            this.clientY = 0;
    
            // Mouse movement listener to get mouse position
            window.addEventListener('mousemove', e => {
                this.clientX = e.clientX;
                this.clientY = e.clientY;
            });
        }
    
        startFalling(delay, speed, size) {
            setTimeout(() => {
                this.cookie.style.animation = `fall ${speed}s linear infinite, swing 1s infinite`;
                this.cookie.style.width = `${size}px`;
                this.cookie.style.height = `${size}px`;
                this.moveTowardsMouse();
            }, delay);
        }
    
        stopFalling() {
            this.cookie.style.animation = '';
        }
    
        moveTowardsMouse() {
            const rect = this.cookie.getBoundingClientRect();
            const dx = this.clientX - rect.x;
            const dy = this.clientY - rect.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance > 1) {
                const speed = 5;  // Adjust this value to change the speed of the falling cookies
                const directionX = dx / distance;
                const directionY = dy / distance;
                const newX = rect.x + directionX * speed;
                const newY = rect.y + directionY * speed;
                this.cookie.style.left = `${newX}px`;
                this.cookie.style.top = `${newY}px`;
            }
            requestAnimationFrame(() => this.moveTowardsMouse());
        }
    }
    
    
    var fallingCookies = [];
    for (var i = 1; i <= 11; i++) {
        var cookie = new FallingCookie('falling-cookie-' + i);
        fallingCookies.push(cookie);
        cookie.startFalling(i * 1500, 25, 50); // Initial delay, speed and size
    }
    

    
    document.addEventListener('wheel', function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('dblclick', function(e){
        e.preventDefault();
    });
    
    
});

window.onload = function() {
    document.getElementById('modal-start').style.display = 'block';
}
