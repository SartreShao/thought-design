document.addEventListener('DOMContentLoaded', () => {
    const exhibitItems = document.querySelectorAll('.exhibit-item');
    const ambientBg = document.getElementById('ambient-bg');

    exhibitItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            const bgClass = item.getAttribute('data-bg');
            if (bgClass) {
                // Remove existing bg classes
                ambientBg.className = 'ambient-background';
                // Add new bg class
                ambientBg.classList.add(bgClass);
            }
        });

        item.addEventListener('mouseleave', () => {
            ambientBg.className = 'ambient-background';
        });
    });
});
