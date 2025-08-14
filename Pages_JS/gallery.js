const images = document.querySelectorAll('.gallery-item img');
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = lightbox.querySelector('img');
            const closeBtn = lightbox.querySelector('.close');
            const prevBtn = lightbox.querySelector('.prev');
            const nextBtn = lightbox.querySelector('.next');
            let currentIndex = 0;

            function openLightbox(index) {
                currentIndex = index;
                lightboxImg.src = images[currentIndex].src;
                lightbox.style.display = 'flex';
                document.body.classList.add('no-scroll'); // lock background scroll
            }

            function closeLightbox() {
                lightbox.style.display = 'none';
                document.body.classList.remove('no-scroll'); // unlock background scroll
            }


            function showPrev() {
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                lightboxImg.src = images[currentIndex].src;
            }

            function showNext() {
                currentIndex = (currentIndex + 1) % images.length;
                lightboxImg.src = images[currentIndex].src;
            }

            images.forEach((img, index) => {
                img.addEventListener('click', () => openLightbox(index));
            });

            closeBtn.addEventListener('click', closeLightbox);
            prevBtn.addEventListener('click', showPrev);
            nextBtn.addEventListener('click', showNext);

            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) closeLightbox();
            });

            document.addEventListener('keydown', (e) => {
                if (lightbox.style.display === 'flex') {
                    if (e.key === 'ArrowLeft') showPrev();
                    if (e.key === 'ArrowRight') showNext();
                    if (e.key === 'Escape') closeLightbox();
                }
            });

            document.getElementById('toggleViewBtn').addEventListener('click', function () {
                const hiddenItems = document.querySelectorAll('.image-gallery .hidden');
                const isHidden = hiddenItems[0].style.display === '' || hiddenItems[0].style.display === 'none';

                hiddenItems.forEach(item => {
                    item.style.display = isHidden ? 'block' : 'none';
                });

                this.textContent = isHidden ? 'View Less' : 'View More';
            });