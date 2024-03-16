document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('header.site');
    const menu = document.querySelector('ul.top-level');
    const mql = globalThis.matchMedia(`(min-width: ${menuSnap}px)`);
    const menuSnap = 650;

    function checkViewport(e) {
        if (e.matches) {
            // If the viewport is at least menuSnap pixels wide
            menu.style.height = 'auto';
        } else {
            // If the viewport is less than menuSnap pixels wide
            menu.style.height = (globalThis.innerHeight - header.offsetHeight) + 'px';
        }
    }

    // Call the function at run time
    checkViewport(mql);
    // Attach listener function on state changes
    mql.addEventListener('change', checkViewport);

    document.getElementById('menu-toggle').addEventListener('change', function () {
        if (this.checked) {
            document.body.classList.add('no-scroll');
            menu.style.height = (globalThis.innerHeight - header.offsetHeight) + 'px';
            console.log('checked', document.body.classList, menu.style.height);
        } else {
            document.body.classList.remove('no-scroll');
            console.log('unchecked', document.body.classList);
        }
    });
});