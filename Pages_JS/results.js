 document.addEventListener('DOMContentLoaded', function() {
            // Tab functionality
            const tabButtons = document.querySelectorAll('.tab-button');
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    document.querySelectorAll('.results-content').forEach(content => content.classList.remove('active'));
                    
                    button.classList.add('active');
                    const classGroup = button.getAttribute('data-class');
                    document.getElementById(classGroup).classList.add('active');
                });
            });

            // Animate counting numbers using requestAnimationFrame
            const animateCount = (element, target) => {
                const duration = 2000;
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const easeOutProgress = 1 - Math.pow(1 - progress, 4); // Ease-out quart
                    const currentValue = Math.floor(easeOutProgress * target);
                    element.textContent = currentValue;
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        element.textContent = target;
                    }
                };
                window.requestAnimationFrame(step);
            };

            // Intersection Observer to trigger animations on scroll
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const statNumber = entry.target.querySelector('.stat-number');
                        if (statNumber && !statNumber.dataset.animated) {
                             const target = parseInt(statNumber.getAttribute('data-count'));
                             animateCount(statNumber, target);
                             statNumber.dataset.animated = 'true';
                        }
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            document.querySelectorAll('.stat-card').forEach(card => {
                observer.observe(card);
            });

            // "Show Full Leaderboard" functionality
            const showLeaderboardBtn = document.getElementById('show-full-leaderboard-btn');
            const fullLeaderboard = document.getElementById('full-leaderboard');

            showLeaderboardBtn.addEventListener('click', () => {
                fullLeaderboard.classList.remove('hidden-list');
                showLeaderboardBtn.style.display = 'none';
            });
        });