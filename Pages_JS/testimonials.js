document.addEventListener('DOMContentLoaded', function() {
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const subjectContents = document.querySelectorAll('.subject-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      subjectContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Show corresponding content
      const subject = button.dataset.subject;
      document.getElementById(subject).classList.add('active');
    });
  });
  
  // Animate counting numbers
const animateCount = (element, target) => {
  const duration = 1000; // Animation duration in ms
  const step = target / (duration / 16); // Calculate step per frame
  
  let current = 0;
  const updateCount = () => {
    current += step;
    if (current < target) {
      element.textContent = Math.floor(current);
      requestAnimationFrame(updateCount);
    } else {
      element.textContent = target;
    }
  };
  
  updateCount();
};

// Use Intersection Observer to trigger animation on scroll
const statNumbers = document.querySelectorAll('.stat-number');

const observer = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const stat = entry.target;
      const target = parseInt(stat.dataset.count);
      animateCount(stat, target);
      observer.unobserve(stat); // Only animate once
    }
  });
}, {
  threshold: 0.5 // Trigger when 50% of the element is visible
});

// Attach observer to each stat-number element
statNumbers.forEach(stat => {
  observer.observe(stat);
});

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});