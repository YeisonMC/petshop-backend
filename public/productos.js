const $ = (selector) => document.querySelector(selector);
const grid = $("#productos");
const status = $("#estado");
const summary = $("#resumen");
const pagination = $("#pagination");
const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const formatPrice = (value) => value == null ? "Consultar precio" : currency.format(Number(value));
const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"></use></svg>`;
const safeImage = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
    catch { return null; }
};

const allowedSorts = new Set(["destacados", "recientes", "precio_asc", "precio_desc", "nombre"]);
const initial = new URLSearchParams(location.search);
const filters = {
    search: initial.get("search") || "",
    categoria: initial.get("categoria") || "",
    sort: allowedSorts.has(initial.get("sort")) ? initial.get("sort") : "destacados",
    destacado: initial.get("destacado") === "true",
    page: Math.max(1, Number(initial.get("page")) || 1)
};
let activeController;

const setStatus = (heading, detail = "", loading = false) => {
    status.hidden = false;
    status.replaceChildren();
    if (loading) {
        const spinner = document.createElement("span");
        spinner.className = "loading-ring";
        status.append(spinner);
    } else {
        const paw = document.createElement("span");
        paw.innerHTML = icon("paw");
        paw.querySelector("svg").style.cssText = "width:44px;height:44px;stroke:none;color:#9bc4a6";
        status.append(paw);
    }
    const title = document.createElement("strong");
    title.textContent = heading;
    status.append(title);
    if (detail) {
        const paragraph = document.createElement("p");
        paragraph.textContent = detail;
        status.append(paragraph);
    }
};

const createCard = (product, index) => {
    const article = document.createElement("article");
    article.className = "product-card";
    article.dataset.aos = "fade-up";
    article.dataset.aosDelay = String((index % 4) * 50);
    article.innerHTML = `
        <div class="product-media"><div class="placeholder">${icon("paw")}</div><span class="product-badge offer" hidden>Oferta</span><span class="product-badge featured" hidden>Destacado</span></div>
        <div class="product-content"><span class="product-brand"></span><h3 class="product-name"></h3><p class="product-description"></p><div class="product-bottom"><div><span class="price-regular"></span><span class="price-main"></span></div><span class="stock"></span></div><button class="product-link" type="button">Ver detalles ${icon("arrow")}</button></div>`;

    const media = article.querySelector(".product-media");
    const source = safeImage(product.imagen_principal);
    if (source) {
        const image = document.createElement("img");
        image.src = source;
        image.alt = product.nombre;
        image.loading = "lazy";
        image.addEventListener("load", () => article.querySelector(".placeholder").remove(), { once: true });
        image.addEventListener("error", () => image.remove(), { once: true });
        media.prepend(image);
    }
    article.querySelector(".product-brand").textContent = product.marca || "PetShop";
    article.querySelector(".product-name").textContent = product.nombre;
    article.querySelector(".product-description").textContent = product.descripcion_corta || "Descubre todos los detalles de este producto.";
    article.querySelector(".price-main").textContent = formatPrice(product.precio_desde);
    article.querySelector(".price-regular").textContent = product.tiene_oferta ? formatPrice(product.precio_regular_desde) : "";
    article.querySelector(".stock").textContent = product.disponible
        ? `${product.stock_disponible} disponibles` : "Sin stock";
    article.querySelector(".stock").classList.toggle("out", !product.disponible);
    article.querySelector(".offer").hidden = !product.tiene_oferta;
    article.querySelector(".featured").hidden = !product.destacado;
    article.querySelector(".product-link").addEventListener("click", () => showDetail(product.slug));
    return article;
};

const renderPagination = ({ page, totalPages }) => {
    pagination.replaceChildren();
    if (totalPages <= 1) return;
    const previous = document.createElement("button");
    previous.textContent = "← Anterior";
    previous.disabled = page <= 1;
    previous.addEventListener("click", () => goToPage(page - 1));
    const current = document.createElement("span");
    current.textContent = `${page} de ${totalPages}`;
    const next = document.createElement("button");
    next.textContent = "Siguiente →";
    next.disabled = page >= totalPages;
    next.addEventListener("click", () => goToPage(page + 1));
    pagination.append(previous, current, next);
};

const syncUrl = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoria) params.set("categoria", filters.categoria);
    if (filters.sort !== "destacados") params.set("sort", filters.sort);
    if (filters.destacado) params.set("destacado", "true");
    if (filters.page > 1) params.set("page", String(filters.page));
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
};

const loadProducts = async () => {
    activeController?.abort();
    activeController = new AbortController();
    const signal = activeController.signal;
    grid.replaceChildren(); pagination.replaceChildren();
    summary.textContent = "Actualizando resultados...";
    setStatus("Buscando cosas bonitas para ellos...", "", true);
    syncUrl();
    const query = new URLSearchParams({ page: String(filters.page), limit: "12", sort: filters.sort });
    if (filters.search) query.set("search", filters.search);
    if (filters.categoria) query.set("categoria", filters.categoria);
    if (filters.destacado) query.set("destacado", "true");
    try {
        const response = await fetch(`/api/productos?${query}`, { headers: { Accept: "application/json" }, signal });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No pudimos consultar el catálogo");
        if (signal.aborted) return;
        summary.textContent = `${payload.pagination.total} producto${payload.pagination.total === 1 ? "" : "s"} para descubrir`;
        if (!payload.data.length) {
            setStatus("No encontramos productos", "Prueba con otra búsqueda o elimina algún filtro.");
            return;
        }
        status.hidden = true;
        const fragment = document.createDocumentFragment();
        payload.data.forEach((product, index) => fragment.append(createCard(product, index)));
        grid.append(fragment);
        renderPagination(payload.pagination);
        window.AOS?.refreshHard();
    } catch (error) {
        if (error.name === "AbortError") return;
        summary.textContent = "El catálogo no está disponible por ahora";
        setStatus("No pudimos cargar los productos", error.message);
    }
};

const goToPage = (page) => {
    filters.page = page;
    loadProducts();
    $("#catalogo").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
};

const showDetail = async (slug) => {
    const dialog = $("#product-dialog");
    const content = $("#detail-content");
    content.className = "";
    content.innerHTML = '<div class="detail-loading">Cargando detalles...</div>';
    dialog.showModal();
    try {
        const response = await fetch(`/api/productos/${encodeURIComponent(slug)}`);
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error?.message || "No pudimos mostrar este producto");
        const product = payload.data;
        content.innerHTML = `<div class="detail-layout"><div class="detail-media"><span class="detail-placeholder">${icon("paw")}</span></div><div class="detail-info"><span class="detail-brand"></span><h2 id="detail-title"></h2><p class="detail-description"></p><div class="detail-price"></div><h3>Presentaciones disponibles</h3><div class="variant-list"></div><p class="detail-help">Esta vista permite explorar el producto. La compra en línea se habilitará en una etapa posterior.</p></div></div>`;
        const media = content.querySelector(".detail-media");
        const url = safeImage(product.imagenes?.[0]?.url_imagen);
        if (url) {
            const image = document.createElement("img");
            image.src = url; image.alt = product.nombre;
            image.addEventListener("load", () => media.querySelector(".detail-placeholder").remove(), { once: true });
            image.addEventListener("error", () => image.remove(), { once: true });
            media.prepend(image);
        }
        content.querySelector(".detail-brand").textContent = product.marca || "PetShop";
        content.querySelector("#detail-title").textContent = product.nombre;
        content.querySelector(".detail-description").textContent = product.descripcion_larga || product.descripcion_corta || "Conoce las opciones disponibles para tu mascota.";
        const prices = product.variantes.filter((v) => v.disponible).map((v) => v.precio_actual);
        content.querySelector(".detail-price").textContent = prices.length ? `Desde ${formatPrice(Math.min(...prices))}` : "Consultar disponibilidad";
        const list = content.querySelector(".variant-list");
        if (!product.variantes.length) list.textContent = "Sin variantes disponibles por ahora.";
        for (const variant of product.variantes) {
            const item = document.createElement("div"); item.className = "variant-choice";
            const name = document.createElement("span"); name.textContent = variant.nombre_variante;
            const price = document.createElement("strong"); price.textContent = variant.disponible ? formatPrice(variant.precio_actual) : "Sin stock";
            item.append(name, price); list.append(item);
        }
    } catch (error) {
        content.textContent = error.message;
        content.className = "detail-loading";
    }
};

const loadCategories = async () => {
    try {
        const response = await fetch("/api/categorias");
        const payload = await response.json();
        if (!response.ok || !payload.success) return;
        const select = $("#category-select");
        for (const category of payload.data) {
            const option = document.createElement("option");
            option.value = category.slug;
            option.textContent = category.nombre;
            select.append(option);
        }
        select.value = filters.categoria;
    } catch { /* El catálogo sigue disponible aunque fallen los filtros de categorías. */ }
};

let searchTimer;
$("#search-input").value = filters.search;
$("#sort-select").value = filters.sort;
$("#featured-only").checked = filters.destacado;
$("#search-input").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.search = event.target.value.trim(); filters.page = 1; loadProducts(); }, 320);
});
$("#category-select").addEventListener("change", (event) => { filters.categoria = event.target.value; filters.page = 1; loadProducts(); });
$("#sort-select").addEventListener("change", (event) => { filters.sort = event.target.value; filters.page = 1; loadProducts(); });
$("#featured-only").addEventListener("change", (event) => { filters.destacado = event.target.checked; filters.page = 1; loadProducts(); });
$("#close-detail").addEventListener("click", () => $("#product-dialog").close());
$("#product-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });

if (window.AOS && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.AOS.init({ duration: 650, once: true, offset: 55, easing: "ease-out-cubic" });
    document.documentElement.classList.add("aos-ready");
}
loadCategories();
loadProducts();
