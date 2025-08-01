// === Auto-Scrolling Slider ===
const slider = document.getElementById("resultsSlider");
const container = document.getElementById("sliderContainer");

if (slider && container) {
  let scrollPosition = 0;
  const scrollSpeed = 1;
  let isPaused = false;

  container.addEventListener("mouseenter", () => isPaused = true);
  container.addEventListener("mouseleave", () => isPaused = false);

  function autoScroll() {
    if (!isPaused) {
      scrollPosition += scrollSpeed;
      slider.style.transform = `translateX(-${scrollPosition}px)`;

      if (scrollPosition >= slider.scrollWidth / 2) {
        scrollPosition = 0;
      }
    }
    requestAnimationFrame(autoScroll);
  }

  autoScroll();
}

const popup = document.getElementById('whatsappPopup');
const closeBtn = document.getElementById('closePopup');
const whatsappIcon = document.getElementById('whatsappIcon');

// Initially hide popup
popup.style.display = 'none';

// Show popup after 3 seconds
setTimeout(() => {
  popup.style.display = 'block';
}, 3000);

// Close popup and show minimized icon
closeBtn.addEventListener('click', () => {
  popup.style.display = 'none';
  whatsappIcon.style.opacity = '0.7';
  whatsappIcon.style.visibility = 'visible';
});

// Reopen popup when icon clicked
whatsappIcon.addEventListener('click', () => {
  popup.style.display = 'block';
  whatsappIcon.style.opacity = '0';
  whatsappIcon.style.visibility = 'hidden';
});

// Make icon draggable
let isDragging = false;
let offsetX, offsetY;

whatsappIcon.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - whatsappIcon.getBoundingClientRect().left;
  offsetY = e.clientY - whatsappIcon.getBoundingClientRect().top;
  whatsappIcon.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    whatsappIcon.style.left = `${x}px`;
    whatsappIcon.style.top = `${y}px`;
    whatsappIcon.style.right = 'unset';
    whatsappIcon.style.bottom = 'unset';
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  whatsappIcon.style.cursor = 'grab';
});
