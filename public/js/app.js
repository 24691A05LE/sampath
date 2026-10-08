// Shared helpers: auth, API, nav, formatting
(function () {
  const state = {
    token: localStorage.getItem('ft_token'),
    user: JSON.parse(localStorage.getItem('ft_user') || 'null'),
  };

  window.App = {
    state,

    api(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (state.token) headers.Authorization = `Bearer ${state.token}`;
      return fetch('api' + path, { ...options, headers }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 && state.token) {
            this.logout();
            window.location.href = 'login.html';
          }
          const err = new Error(data.message || 'Request failed');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    },

    login(token, user) {
      state.token = token;
      state.user = user;
      localStorage.setItem('ft_token', token);
      localStorage.setItem('ft_user', JSON.stringify(user));
    },

    logout() {
      state.token = null;
      state.user = null;
      localStorage.removeItem('ft_token');
      localStorage.removeItem('ft_user');
    },

    isLoggedIn() {
      return Boolean(state.token && state.user);
    },

    isAdmin() {
      return this.isLoggedIn() && state.user.role === 'admin';
    },

    requireAuth() {
      if (!this.isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },

    requireAdmin() {
      if (!this.requireAuth()) return false;
      if (!this.isAdmin()) {
        window.location.href = 'dashboard.html';
        return false;
      }
      return true;
    },

    refreshUser() {
      return this.api('/auth/me').then((data) => {
        state.user = data.user;
        localStorage.setItem('ft_user', JSON.stringify(data.user));
        return data.user;
      });
    },

    money(amount) {
      const currency = (state.user && state.user.currency) || 'USD';
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
      } catch (e) {
        return `$${Number(amount).toFixed(2)}`;
      }
    },

    date(d) {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
  };

  // Sidebar / header injection for app pages
  window.AppNav = {
    inject(active) {
      const user = App.state.user;
      const adminLink = App.isAdmin() ? `<a href="admin.html" class="${active === 'admin' ? 'active' : ''}"><span class="nav-icon">&#9881;</span> Admin Panel</a>` : '';
      document.querySelectorAll('[data-nav]').forEach((el) => {
        el.innerHTML = `
          <header class="sidebar-header">
            <div class="brand">&#128176; FinanceTracker</div>
          </header>
          <nav class="side-nav">
            <a href="dashboard.html" class="${active === 'dashboard' ? 'active' : ''}"><span class="nav-icon">&#128200;</span> Dashboard</a>
            <a href="transactions.html" class="${active === 'transactions' ? 'active' : ''}"><span class="nav-icon">&#128203;</span> Transactions</a>
            <a href="budgets.html" class="${active === 'budgets' ? 'active' : ''}"><span class="nav-icon">&#128181;</span> Budgets</a>
            <a href="savings.html" class="${active === 'savings' ? 'active' : ''}"><span class="nav-icon">&#128176;</span> Savings Goals</a>
            <a href="reports.html" class="${active === 'reports' ? 'active' : ''}"><span class="nav-icon">&#128202;</span> Reports</a>
            ${adminLink}
          </nav>
          <div class="sidebar-footer">
            <div class="user-chip">
              <div class="avatar">${user ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div class="user-meta">
                <strong>${App.esc(user ? user.name : 'User')}</strong>
                <small>${App.esc(user ? user.email : '')}${App.isAdmin() ? ' &middot; Admin' : ''}</small>
              </div>
            </div>
            <button class="btn btn-outline btn-sm btn-block" id="logoutBtn">Log out</button>
          </div>`;
      });
      const btn = document.getElementById('logoutBtn');
      if (btn) btn.addEventListener('click', () => { App.logout(); window.location.href = 'login.html'; });
    },
  };
})();
