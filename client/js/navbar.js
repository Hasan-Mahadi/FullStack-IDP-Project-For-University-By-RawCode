document.addEventListener("DOMContentLoaded", () => {
  // 1. Dynamic Injection (checks for container placeholders)
  const headerPlaceholder = document.getElementById("main-header");
  const footerPlaceholder = document.getElementById("main-footer");

  if (headerPlaceholder) {
    headerPlaceholder.innerHTML = `
            <nav class="main-navbar" id="mainNavbar">
                <div class="nav-container">
                    <a href="/" class="nav-brand">EduShop<span>.campus</span></a>
                    
                    <ul class="nav-links" id="navLinks">
                        <li><a href="/" class="nav-link" id="navLinkHome">Home</a></li>
                        <li><a href="/pages/categories.html" class="nav-link" id="navLinkCategories">Categories</a></li>
                        <li><a href="/pages/about.html" class="nav-link" id="navLinkAbout">About Us</a></li>
                        <li><a href="/pages/contact.html" class="nav-link" id="navLinkContact">Contact</a></li>
                    </ul>
                    
                    <div class="nav-controls">
                        <button class="cart-badge-trigger" id="cartTrigger" title="Shopping Cart">
                            <span style="font-size: 1.25rem;">🛒</span>
                            <span class="cart-count" id="cartBadgeCount" style="display: none;">0</span>
                        </button>
                        <div id="authNavContainer" style="display: flex; align-items: center;">
                            <a href="/pages/login.html" class="btn btn-secondary btn-sm">Sign In</a>
                        </div>
                        <div class="nav-burger" id="navBurger">
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            </nav>
        `;
  }

  if (footerPlaceholder) {
    footerPlaceholder.innerHTML = `
            <footer class="main-footer">
                <div class="footer-container">
                    <div class="footer-logo-side">
                        <a href="/" class="nav-brand" style="margin-bottom: 12px; display: inline-block;">EduShop<span>.campus</span></a>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6;">
                            An elegant, secure academic trading ecosystem connecting Students, Campus Sellers, and logistics Service Teams.
                        </p>
                    </div>
                    <div>
                        <h4 class="footer-heading">Quick Links</h4>
                        <ul class="footer-links">
                            <li><a href="/">Home</a></li>
                            <li><a href="/pages/categories.html">Categories</a></li>
                            <li><a href="/pages/about.html">About Us</a></li>
                            <li><a href="/pages/contact.html">Contact Us</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="footer-heading">Platform Role Portals</h4>
                        <ul class="footer-links">
                            <li><a href="/pages/login.html">Student Customer Console</a></li>
                            <li><a href="/pages/login.html">Merchant Seller Portal</a></li>
                            <li><a href="/pages/login.html">Operations Service Hub</a></li>
                            <li><a href="/pages/login.html">System Admin Suite</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="footer-heading">Contact Details</h4>
                        <ul class="footer-links" style="color: var(--text-secondary); font-size: 0.85rem;">
                            <li style="margin-bottom: 8px;">📍 Campus Central Hall, Room 102</li>
                            <li style="margin-bottom: 8px;">📞 +1 (555) 234-5678</li>
                            <li style="margin-bottom: 8px;">✉️ support@edushop.campus.edu</li>
                        </ul>
                    </div>
                </div>
                <div class="footer-bottom">
                    <span>© 2026 EduShop Campus Trading Ecosystem. Integrated Design Project.</span>
                    <span>Made with ❤️ by IDP Student Team</span>
                </div>
            </footer>
        `;
  }

  // 2. Mobile Burger Navigation Menu
  const burger = document.getElementById("navBurger");
  const links = document.getElementById("navLinks");
  if (burger && links) {
    burger.addEventListener("click", () => {
      links.classList.toggle("active");
    });
  }

  // 3. Highlight Active Storefront Route
  const pathname = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (
      href === pathname ||
      (pathname === "/" && href === "/") ||
      (pathname === "/index.html" && href === "/") ||
      (pathname.includes("categories") && href.includes("categories")) ||
      (pathname.includes("about") && href.includes("about")) ||
      (pathname.includes("contact") && href.includes("contact"))
    ) {
      link.classList.add("active");
    }
  });

  // 4. Sticky Glass Scroll Opacity Effect
  window.addEventListener("scroll", () => {
    const navbar = document.getElementById("mainNavbar");
    if (navbar) {
      if (window.scrollY > 40) {
        navbar.classList.add("navbar-scrolled");
      } else {
        navbar.classList.remove("navbar-scrolled");
      }
    }
  });

  // 5. Update Auth Profile State Actions
  window.updateAuthNav = function () {
    const container = document.getElementById("authNavContainer");
    if (container) {
      const user = Auth.getUser();
      if (user) {
        const avatarChar = user.fullName
          ? user.fullName.charAt(0).toUpperCase()
          : "U";
        const roleId = Number(user.roleId);
        const roleNames = {
          1: "Admin",
          2: "Seller",
          3: "Customer",
          4: "Service Team",
        };
        const roleName = roleNames[roleId] || "User";

        container.innerHTML = `
                    <div class="user-nav-profile">
                        <div class="nav-avatar">${avatarChar}</div>
                        <div class="nav-user-details">
                            <span class="nav-username">${user.fullName}</span>
                            <span class="nav-role-badge role-${roleId}">${roleName}</span>
                        </div>
                        <button class="btn btn-primary btn-sm" id="navConsoleBtn" style="padding: 6px 12px; font-size: 0.75rem; margin-left: 8px;">Console</button>
                        <button class="nav-logout-btn" id="navSignoutBtn" style="margin-left: 8px;" title="Sign Out">✕</button>
                    </div>
                `;
        document
          .getElementById("navConsoleBtn")
          .addEventListener("click", () => {
            Auth.redirectDashboard(user.roleId);
          });
        document
          .getElementById("navSignoutBtn")
          .addEventListener("click", () => {
            Auth.logout();
          });
      } else {
        container.innerHTML = `
                    <a href="/pages/login.html" class="btn btn-secondary btn-sm">Sign In</a>
                    <a href="/pages/register.html" class="btn btn-primary btn-sm" style="margin-left: 8px;">Register</a>
                `;
      }
    }
  };
  updateAuthNav();

  // 6. Update Shopping Cart Badge Counts
  window.updateCartBadge = function () {
    const cartCountBadge = document.getElementById("cartBadgeCount");
    if (cartCountBadge) {
      const stored = localStorage.getItem("idp_shopping_cart");
      let count = 0;
      if (stored) {
        try {
          const cart = JSON.parse(stored);
          count = cart.reduce((sum, item) => sum + item.quantity, 0);
        } catch (e) {
          count = 0;
        }
      }
      if (count > 0) {
        cartCountBadge.innerText = count;
        cartCountBadge.style.display = "flex";
      } else {
        cartCountBadge.style.display = "none";
      }
    }
  };
  updateCartBadge();

  // Listen to localstorage updates or custom events
  window.addEventListener("storage", updateCartBadge);
  window.addEventListener("cartUpdated", updateCartBadge);

  // Global Cart Drawer Controllers
  window.openCartDrawer = function () {
    const drawer = document.getElementById("cartDrawer");
    let overlay = document.querySelector(".cart-drawer-overlay");
    if (!overlay && document.body) {
      overlay = document.createElement("div");
      overlay.className = "cart-drawer-overlay";
      document.body.appendChild(overlay);
    }
    if (drawer) drawer.classList.add("active");
    if (overlay) overlay.classList.add("active");
  };

  window.closeCartDrawer = function () {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.querySelector(".cart-drawer-overlay");
    if (drawer) drawer.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
  };

  // Cart Drawer Toggle
  const cartTrigger = document.getElementById("cartTrigger");
  if (cartTrigger) {
    cartTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      window.openCartDrawer();
    });
  }

  // Attach click listener for closing the drawer
  document.addEventListener("click", (e) => {
    const drawer = document.getElementById("cartDrawer");
    const trigger = document.getElementById("cartTrigger");
    if (drawer && drawer.classList.contains("active")) {
      if (
        !drawer.contains(e.target) &&
        (!trigger || !trigger.contains(e.target))
      ) {
        window.closeCartDrawer();
      }
    }
  });

  const cartCloseBtn = document.getElementById("cartClose");
  if (cartCloseBtn) {
    cartCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.closeCartDrawer();
    });
  }
});
