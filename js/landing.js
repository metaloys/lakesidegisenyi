/** Public landing UI: scroll reveal and menu tabs. */
(function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
})();

function switchTab(name, btn) {
  document.querySelectorAll('.menu-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.menu-tab').forEach((t) => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}
