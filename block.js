 function showActionCard(intensity) {
            // Hide all cards first
            const cards = document.querySelectorAll('.action-card');
            cards.forEach(card => {
                card.style.display = 'none';
            });
            
            // Show selected card
            const selectedCard = document.getElementById(intensity + '-card');
            selectedCard.style.display = 'block';
            
            // Smooth scroll to the card
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add highlight effect
            selectedCard.style.transform = 'scale(1.02)';
            setTimeout(() => {
                selectedCard.style.transform = 'scale(1)';
            }, 200);
        }

        // Add click handlers for time circles
        document.querySelectorAll('.time-circle').forEach(circle => {
            circle.addEventListener('click', function() {
                this.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 200);
            });
        });

        // Add fade-in animation on scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.action-card, .time-perspective, .urge-section, .resources-section').forEach(el => {
            observer.observe(el);
        });

        // Initially show all cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.style.display = 'block';
        });