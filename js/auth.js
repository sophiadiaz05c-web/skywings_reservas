const Auth = (() => {
  const SESSION_KEY = 'sw_session';
  const ADMIN_EMAIL = 'admin@skywings.com';
  const ADMIN_PASS  = 'admin123';

  // FNV-1a hash — not cryptographic but avoids storing plaintext passwords
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: user.id,
      name:   user.name,
      email:  user.email,
      role:   user.role
    }));
  }

  // ── Public API ────────────────────────────────────────────────────────

  function login(email, password) {
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASS) {
      setSession({ id: 'admin', name: 'Administrador', email: ADMIN_EMAIL, role: 'admin' });
      return { ok: true };
    }
    const user = SW.getUsers().find(u => u.email === email.trim().toLowerCase());
    if (!user)                          return { ok: false, msg: 'Correo no registrado.' };
    if (user.passwordHash !== hash(password)) return { ok: false, msg: 'Contraseña incorrecta.' };
    setSession(user);
    return { ok: true };
  }

  function register(name, email, password) {
    email = email.trim().toLowerCase();
    if (email === ADMIN_EMAIL)
      return { ok: false, msg: 'Este correo está reservado.' };
    if (SW.getUsers().some(u => u.email === email))
      return { ok: false, msg: 'Este correo ya está registrado.' };
    const user = SW.addUser({ name: name.trim(), email, passwordHash: hash(password), role: 'user' });
    setSession(user);
    return { ok: true };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }

  // Redirects to login.html if not authenticated; returns session if ok.
  function requireAuth() {
    const s = getSession();
    if (!s) { window.location.href = 'login.html'; return null; }
    return s;
  }

  // Redirects if not admin.
  function requireAdmin() {
    const s = getSession();
    if (!s) { window.location.href = 'login.html'; return null; }
    if (s.role !== 'admin') {
      alert('Acceso restringido al panel de administración.');
      window.location.href = 'index.html';
      return null;
    }
    return s;
  }

  // Injects the logged-in user info (or sign-in link) at the end of .navbar-nav.
  function initNavbar() {
    const nav = document.querySelector('.navbar-nav');
    if (!nav) return;
    const s   = getSession();
    const li  = document.createElement('li');
    li.id     = 'nav-user-slot';
    li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:0 4px;margin-left:8px;';

    if (s) {
      li.innerHTML = `
        ${s.role === 'admin' ? '<span class="badge-admin">ADMIN</span>' : ''}
        <span style="color:rgba(255,255,255,0.85);font-size:0.82rem;white-space:nowrap;">👤 ${s.name}</span>
        <button onclick="Auth.logout()"
          style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.3);
                 padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78rem;font-weight:600;">
          Salir
        </button>`;
    } else {
      li.innerHTML = `
        <a href="login.html"
          style="color:#fff;text-decoration:none;padding:6px 14px;border-radius:6px;
                 font-size:0.82rem;font-weight:700;border:1px solid rgba(255,255,255,0.35);">
          Iniciar Sesión
        </a>`;
    }
    nav.appendChild(li);
  }

  return { login, register, logout, getSession, requireAuth, requireAdmin, initNavbar };
})();
