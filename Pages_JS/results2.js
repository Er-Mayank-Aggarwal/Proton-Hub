// results.js
document.addEventListener('DOMContentLoaded', function() {
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and content
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.results-content').forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const classGroup = button.getAttribute('data-class');
      document.getElementById(classGroup).classList.add('active');
    });
  });

  // Animate counting numbers
  const animateCount = (element, target) => {
    const duration = 1500; // Faster animation
    const start = 0;
    const increment = target / (duration / 16); // Roughly 60fps
    
    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        clearInterval(timer);
        current = target;
      }
      element.textContent = Math.floor(current);
    }, 16);
  };

  document.querySelectorAll('.stat-number').forEach(element => {
    const target = parseInt(element.getAttribute('data-count'));
    animateCount(element, target);
  });

  // View more functionality
  const viewMoreBtn = document.querySelector('.view-more-btn');
  if (viewMoreBtn) {
    viewMoreBtn.addEventListener('click', () => {
      // This would ideally load more results via AJAX in a real implementation
      alert('More students would be loaded here in a full implementation');
    });
  }
});