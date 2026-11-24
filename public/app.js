// ShopLite UI: plain JS on purpose, so the focus of this repo stays on the tests.
const $ = (sel) => document.querySelector(sel);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

const state = {
  get token() { return localStorage.getItem('token'); },
  get user() { return JSON.parse(localStorage.getItem('user') ?? 'null'); },
  get cart() { return JSON.parse(localStorage.getItem('cart') ?? '[]'); },
  set cart(items) { localStorage.setItem('cart', JSON.stringify(items)); renderCartCount(); },
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) {
    logout();
    throw new Error('Your session expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(body.error?.message ?? 'Something went wrong. Please try again.');
  return body;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3000);
}

function renderCartCount() {
  $('[data-testid="cart-count"]').textContent = state.cart.reduce((n, i) => n + i.quantity, 0);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('cart');
  location.hash = '#/login';
}

// ---------- views ----------
async function renderCatalog() {
  const params = new URLSearchParams();
  if ($('#search').value) params.set('search', $('#search').value);
  if ($('#category').value) params.set('category', $('#category').value);
  showError($('#catalog-error'), '');
  const list = $('#product-list');
  try {
    const { items } = await api(`/products?${params}`);
    list.innerHTML = '';
    if (items.length === 0) list.innerHTML = '<li>No products match your search.</li>';
    for (const p of items) {
      const li = document.createElement('li');
      li.className = 'card';
      li.dataset.testid = 'product-card';
      li.innerHTML = `
        <h2>${p.name}</h2>
        <span data-testid="product-price">${money(p.priceCents)}</span>
        ${p.inStock ? `<span>${p.stock} in stock</span>` : '<span class="out">Out of stock</span>'}
        <button type="button" ${p.inStock ? '' : 'disabled'} aria-label="Add ${p.name} to cart">Add to cart</button>`;
      li.querySelector('button').addEventListener('click', () => addToCart(p));
      list.append(li);
    }
  } catch (e) {
    list.innerHTML = '';
    showError($('#catalog-error'), e.message);
  }
}

function addToCart(p) {
  const cart = state.cart;
  const existing = cart.find((i) => i.productId === p.id);
  if (existing) existing.quantity += 1;
  else cart.push({ productId: p.id, name: p.name, priceCents: p.priceCents, quantity: 1 });
  state.cart = cart;
  toast(`${p.name} added to cart`);
}

function renderCart() {
  const cart = state.cart;
  const empty = cart.length === 0;
  $('#cart-empty').hidden = !empty;
  $('#cart-table').hidden = empty;
  $('#checkout-form').hidden = empty;
  showError($('#checkout-error'), '');
  const rows = $('#cart-rows');
  rows.innerHTML = '';
  for (const item of cart) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td>
      <td><input type="number" min="1" max="20" value="${item.quantity}" aria-label="Quantity of ${item.name}" /></td>
      <td>${money(item.priceCents * item.quantity)}</td>
      <td><button type="button" aria-label="Remove ${item.name}">Remove</button></td>`;
    tr.querySelector('input').addEventListener('change', (e) => {
      const qty = Math.max(1, Math.min(20, Number(e.target.value) || 1));
      state.cart = state.cart.map((i) => (i.productId === item.productId ? { ...i, quantity: qty } : i));
      renderCart();
    });
    tr.querySelector('button').addEventListener('click', () => {
      state.cart = state.cart.filter((i) => i.productId !== item.productId);
      renderCart();
    });
    rows.append(tr);
  }
  $('[data-testid="cart-subtotal"]').textContent = money(cart.reduce((s, i) => s + i.priceCents * i.quantity, 0));
}

async function renderOrders() {
  const { items } = await api('/orders');
  $('#orders-empty').hidden = items.length > 0;
  const list = $('#orders-list');
  list.innerHTML = '';
  for (const o of items) {
    const li = document.createElement('li');
    li.dataset.testid = 'order-row';
    li.innerHTML = `<strong>#${o.id}</strong>
      <span data-testid="order-status">${o.status}</span>
      <span>${money(o.totalCents)}</span>
      ${o.status === 'CREATED' ? `<button type="button" aria-label="Cancel order ${o.id}">Cancel</button>` : ''}`;
    li.querySelector('button')?.addEventListener('click', async () => {
      try {
        await api(`/orders/${o.id}/cancel`, { method: 'POST' });
        toast(`Order #${o.id} cancelled`);
        renderOrders();
      } catch (e) {
        toast(e.message);
      }
    });
    list.append(li);
  }
}

// ---------- events ----------
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (!email || !password) return showError($('#login-error'), 'Email and password are required');
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    location.hash = '#/catalog';
  } catch (err) {
    showError($('#login-error'), err.message);
  }
});

$('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true; // prevent double submit
  try {
    const couponCode = $('#coupon').value.trim() || undefined;
    const order = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart.map(({ productId, quantity }) => ({ productId, quantity })), couponCode }),
    });
    state.cart = [];
    $('#coupon').value = '';
    $('[data-testid="order-id"]').textContent = `#${order.id}`;
    $('[data-testid="order-discount"]').textContent = money(order.discountCents);
    $('[data-testid="order-total"]').textContent = money(order.totalCents);
    location.hash = '#/confirmation';
  } catch (err) {
    showError($('#checkout-error'), err.message);
  } finally {
    button.disabled = false;
  }
});

let searchTimer;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderCatalog, 250);
});
$('#category').addEventListener('change', renderCatalog);
$('#logout').addEventListener('click', logout);

// ---------- router ----------
const views = ['login', 'catalog', 'cart', 'confirmation', 'orders'];
async function route() {
  let view = location.hash.replace('#/', '') || 'catalog';
  if (!views.includes(view)) view = 'catalog';
  if (!state.token && view !== 'login') {
    location.hash = '#/login';
    return;
  }
  if (state.token && view === 'login') {
    location.hash = '#/catalog';
    return;
  }
  for (const v of views) $(`#view-${v}`).hidden = v !== view;
  $('#nav').hidden = !state.token;
  if (state.user) $('[data-testid="user-name"]').textContent = state.user.name;
  renderCartCount();
  if (view === 'catalog') await renderCatalog();
  if (view === 'cart') renderCart();
  if (view === 'orders') await renderOrders().catch((e) => toast(e.message));
}
window.addEventListener('hashchange', route);
route();
