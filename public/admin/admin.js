const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const money = (value) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" })
    .format(Number(value || 0));
const safeImage = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; }
    catch { return null; }
};
const slugify = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const state = {
    token: sessionStorage.getItem("petshop.adminToken") || "",
    user: null,
    page: "resumen",
    products: { page: 1, search: "", estado: "" },
    inventory: { page: 1, search: "", bajo_minimo: "" },
    brands: [], categories: [], renderId: 0
};
const labels = {
    resumen: ["Resumen", "VISTA GENERAL", "Una mirada clara a todo lo que ocurre en tu tienda."],
    productos: ["Productos", "CATÁLOGO", "Organiza y actualiza lo que tus clientes descubren."],
    inventario: ["Inventario", "CONTROL DE STOCK", "Cada movimiento registrado, cada reserva bajo control."],
    categorias: ["Categorías", "ORGANIZACIÓN", "Una estructura sencilla para que encuentren lo que buscan."],
    marcas: ["Marcas", "MARCAS", "Gestiona las marcas presentes en tu catálogo."]
};

const api = async (path, options = {}) => {
    const response = await fetch(path, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
            ...options.headers
        }
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
        if (response.status === 401 && state.token) logout("Tu sesión terminó. Ingresa de nuevo.");
        throw new Error(payload.error?.message || `Error ${response.status}`);
    }
    return payload;
};
const send = (path, method, body) => api(path, { method, body: JSON.stringify(body) });

const toast = (message, error = false) => {
    const item = document.createElement("div");
    item.className = `toast${error ? " error" : ""}`;
    item.textContent = message;
    $("#toast-region").append(item);
    setTimeout(() => item.remove(), 4300);
};
const loading = () => { $("#page-content").innerHTML = '<div class="loading-state"><span class="spinner"></span> Cargando información...</div>'; };
const empty = (title, detail) => `<div class="empty-state">${icon("box")}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>`;
const pill = (active, text = null, warning = false) =>
    `<span class="status-pill ${warning ? "warning" : active ? "" : "inactive"}">${escapeHtml(text ?? (active ? "Activo" : "Inactivo"))}</span>`;
const cellProduct = (product) => {
    const src = safeImage(product.imagen);
    return `<span class="product-cell"><span class="thumb">${src ? `<img src="${escapeHtml(src)}" alt="">` : icon("paw")}</span><span class="item-name">${escapeHtml(product.nombre)}<small class="item-sub">${escapeHtml(product.slug)}</small></span></span>`;
};
const pageFooter = (pagination, key) => `<div class="table-footer"><span>${pagination.total} registro${pagination.total === 1 ? "" : "s"} · Página ${pagination.page} de ${Math.max(1, pagination.totalPages)}</span><div class="pagination"><button type="button" data-action="page" data-list="${key}" data-direction="-1" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button><button type="button" data-action="page" data-list="${key}" data-direction="1" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Siguiente</button></div></div>`;

const closeSidebar = () => {
    $("#sidebar").classList.remove("open");
    $("#sidebar-backdrop").hidden = true;
};
const logout = (message = "") => {
    state.token = ""; state.user = null;
    sessionStorage.removeItem("petshop.adminToken");
    $("#admin-view").hidden = true;
    $("#login-view").hidden = false;
    closeSidebar();
    if (message) toast(message, true);
};
const enter = (user) => {
    state.user = user;
    $("#login-view").hidden = true;
    $("#admin-view").hidden = false;
    $("#admin-name").textContent = user.nombres;
    $("#admin-avatar").textContent = (user.nombres || "A")[0].toUpperCase();
    navigate("resumen");
};

const navigate = async (page) => {
    if (!labels[page] || !state.token) return;
    state.page = page;
    const [title, eyebrow, description] = labels[page];
    $("#breadcrumb-page").textContent = title;
    $("#page-title").textContent = title;
    $("#page-eyebrow").textContent = eyebrow;
    $("#page-description").textContent = description;
    $("#page-actions").replaceChildren();
    document.querySelectorAll(".nav-link").forEach((button) =>
        button.classList.toggle("active", button.dataset.page === page));
    closeSidebar();
    loading();
    const renderId = ++state.renderId;
    try {
        if (page === "resumen") await renderOverview(renderId);
        if (page === "productos") await renderProducts(renderId);
        if (page === "inventario") await renderInventory(renderId);
        if (page === "categorias") await renderCategories(renderId);
        if (page === "marcas") await renderBrands(renderId);
    } catch (error) {
        if (renderId === state.renderId) $("#page-content").innerHTML = empty("No pudimos cargar esta sección", error.message);
    }
};
const actionButton = (text, action, iconName = "plus") => {
    const button = document.createElement("button");
    button.className = "button button-primary";
    button.dataset.action = action;
    button.innerHTML = `${icon(iconName)} ${escapeHtml(text)}`;
    $("#page-actions").append(button);
};

const renderOverview = async (id) => {
    const [stats, products, inventory] = await Promise.all([
        api("/api/admin/resumen"),
        api("/api/admin/productos?limit=5"),
        api("/api/admin/inventario?limit=5&bajo_minimo=true")
    ]);
    if (id !== state.renderId) return;
    actionButton("Nuevo producto", "new-product");
    const cards = [
        ["Productos", stats.data.productos, "box", `${stats.data.productos_activos} activos`],
        ["Variantes activas", stats.data.variantes_activas, "stack", "En el catálogo"],
        ["Categorías", stats.data.categorias_activas, "tag", "Disponibles"],
        ["Stock bajo", stats.data.stock_bajo, "alert", "Requieren atención"]
    ];
    $("#page-content").innerHTML = `
        <section class="hero-panel"><div><span class="eyebrow">BIENVENIDO A PETSHOP STUDIO</span><h2>El control empieza aquí.</h2><p>Revisa el catálogo y mantén cada producto listo para tus clientes.</p></div><button class="button" data-action="new-product">${icon("plus")} Crear producto</button></section>
        <section class="stat-grid" aria-label="Indicadores">${cards.map(([label, value, glyph, note], i) => `<div class="stat-card ${i === 3 ? "warning" : ""}"><div class="stat-top"><span>${escapeHtml(label)}</span><span class="stat-icon">${icon(glyph)}</span></div><div class="stat-number">${Number(value)}</div><div class="stat-note">${escapeHtml(note)}</div></div>`).join("")}</section>
        <div class="dashboard-grid"><section class="panel"><div class="panel-header"><h3>Productos recientes</h3><button class="text-link" data-action="nav" data-page="productos">Ver todos →</button></div>${products.data.length ? products.data.map((p) => `<div class="list-row"><div><strong>${escapeHtml(p.nombre)}</strong><small>${escapeHtml(p.marca || "Sin marca")}</small></div>${pill(p.estado === "ACTIVO", p.estado)}</div>`).join("") : empty("Sin productos", "Crea el primero para comenzar.")}</section><section class="panel"><div class="panel-header"><h3>Atención de inventario</h3><button class="text-link" data-action="nav" data-page="inventario">Ver inventario →</button></div>${inventory.data.length ? inventory.data.map((i) => `<div class="list-row"><div><strong>${escapeHtml(i.producto)}</strong><small>${escapeHtml(i.sku)}</small></div><span class="list-meta text-warn">${Number(i.stock_disponible)} disp.</span></div>`).join("") : empty("Todo en orden", "No hay variantes bajo el mínimo.")}</section></div>`;
};

const renderProducts = async (id) => {
    const q = new URLSearchParams({ page: state.products.page, limit: 12 });
    if (state.products.search) q.set("search", state.products.search);
    if (state.products.estado) q.set("estado", state.products.estado);
    const result = await api(`/api/admin/productos?${q}`);
    if (id !== state.renderId) return;
    actionButton("Nuevo producto", "new-product");
    $("#page-content").innerHTML = `
        <div class="toolbar"><div class="search-wrap">${icon("search")}<input class="toolbar-input" data-filter="product-search" type="search" placeholder="Buscar por nombre o slug" value="${escapeHtml(state.products.search)}" aria-label="Buscar productos"></div><select class="toolbar-select" data-filter="product-state" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${["ACTIVO", "INACTIVO", "AGOTADO", "DESCONTINUADO"].map((s) => `<option value="${s}" ${state.products.estado === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="table-card"><table class="data-table"><thead><tr><th>Producto</th><th>Marca</th><th>Estado</th><th>Variantes</th><th>Disponible</th><th>Acciones</th></tr></thead><tbody>${result.data.map((p) => `<tr><td>${cellProduct(p)}</td><td>${escapeHtml(p.marca || "—")}</td><td>${pill(p.estado === "ACTIVO", p.estado, p.estado === "AGOTADO")}</td><td>${Number(p.variantes)}</td><td>${Number(p.stock_disponible)}</td><td><div class="row-actions"><button class="row-button" data-action="view-product" data-id="${Number(p.id_producto)}">Gestionar</button></div></td></tr>`).join("")}</tbody></table>${result.data.length ? pageFooter(result.pagination, "products") : empty("No encontramos productos", "Prueba con otra búsqueda o crea uno nuevo.")}</div>`;
};

const renderInventory = async (id) => {
    const q = new URLSearchParams({ page: state.inventory.page, limit: 12 });
    if (state.inventory.search) q.set("search", state.inventory.search);
    if (state.inventory.bajo_minimo) q.set("bajo_minimo", state.inventory.bajo_minimo);
    const result = await api(`/api/admin/inventario?${q}`);
    if (id !== state.renderId) return;
    $("#page-content").innerHTML = `
        <div class="toolbar"><div class="search-wrap">${icon("search")}<input class="toolbar-input" data-filter="inventory-search" type="search" placeholder="Buscar producto, variante o SKU" value="${escapeHtml(state.inventory.search)}" aria-label="Buscar inventario"></div><select class="toolbar-select" data-filter="inventory-low" aria-label="Filtrar inventario"><option value="">Todo el inventario</option><option value="true" ${state.inventory.bajo_minimo === "true" ? "selected" : ""}>Bajo mínimo</option><option value="false" ${state.inventory.bajo_minimo === "false" ? "selected" : ""}>Sobre mínimo</option></select></div>
        <div class="table-card"><table class="data-table"><thead><tr><th>Variante</th><th>Físico</th><th>Reservado</th><th>Disponible</th><th>Mínimo</th><th>Acciones</th></tr></thead><tbody>${result.data.map((i) => `<tr><td class="item-name">${escapeHtml(i.producto)}<small class="item-sub">${escapeHtml(i.nombre_variante)} · ${escapeHtml(i.sku)}</small></td><td>${Number(i.stock_actual)}</td><td>${Number(i.stock_reservado)}</td><td>${pill(i.stock_disponible > i.stock_minimo, `${Number(i.stock_disponible)} unidades`, i.stock_disponible <= i.stock_minimo)}</td><td>${Number(i.stock_minimo)}</td><td><div class="row-actions"><button class="row-button" data-action="adjust-stock" data-id="${Number(i.id_variante)}">Ajustar</button><button class="row-button" data-action="inventory-settings" data-id="${Number(i.id_variante)}">Configurar</button><button class="row-button" data-action="movements" data-id="${Number(i.id_variante)}">Historial</button></div></td></tr>`).join("")}</tbody></table>${result.data.length ? pageFooter(result.pagination, "inventory") : empty("Sin registros", "No hay variantes para este filtro.")}</div>`;
};

const renderCategories = async (id) => {
    const result = await api("/api/admin/categorias");
    if (id !== state.renderId) return;
    state.categories = result.data;
    actionButton("Nueva categoría", "new-category");
    $("#page-content").innerHTML = `<div class="table-card"><table class="data-table"><thead><tr><th>Categoría</th><th>Slug</th><th>Jerarquía</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${result.data.map((c) => `<tr><td class="item-name">${escapeHtml(c.nombre)}</td><td>${escapeHtml(c.slug)}</td><td>${escapeHtml(state.categories.find((p) => p.id_categoria === c.id_categoria_padre)?.nombre || "Raíz")}</td><td>${pill(Boolean(c.estado))}</td><td><button class="row-button" data-action="edit-category" data-id="${Number(c.id_categoria)}">Editar</button></td></tr>`).join("")}</tbody></table>${result.data.length ? "" : empty("Sin categorías", "Crea una categoría para organizar tus productos.")}</div>`;
};
const renderBrands = async (id) => {
    const result = await api("/api/admin/marcas");
    if (id !== state.renderId) return;
    state.brands = result.data;
    actionButton("Nueva marca", "new-brand");
    $("#page-content").innerHTML = `<div class="table-card"><table class="data-table"><thead><tr><th>Marca</th><th>Descripción</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${result.data.map((b) => `<tr><td class="item-name">${escapeHtml(b.nombre)}</td><td>${escapeHtml(b.descripcion || "—")}</td><td>${pill(Boolean(b.estado))}</td><td><button class="row-button" data-action="edit-brand" data-id="${Number(b.id_marca)}">Editar</button></td></tr>`).join("")}</tbody></table>${result.data.length ? "" : empty("Sin marcas", "Agrega una marca para empezar.")}</div>`;
};

const refreshChoices = async () => {
    const [brands, categories] = await Promise.all([
        api("/api/admin/marcas"), api("/api/admin/categorias")
    ]);
    state.brands = brands.data; state.categories = categories.data;
};
const showDialog = (title, html, onSubmit = null) => {
    $("#dialog-title").textContent = title;
    $("#dialog-body").innerHTML = html;
    const dialog = $("#editor-dialog");
    dialog.showModal();
    const form = $("#dialog-body form");
    if (form && onSubmit) form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try { await onSubmit(new FormData(form)); dialog.close(); await navigate(state.page); }
        catch (error) { toast(error.message, true); submit.disabled = false; }
    });
};
const field = (label, name, value = "", type = "text", extra = "") =>
    `<div class="field"><label for="f-${name}">${escapeHtml(label)}</label><input id="f-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></div>`;
const textArea = (label, name, value = "") =>
    `<div class="field field-full"><label for="f-${name}">${escapeHtml(label)}</label><textarea id="f-${name}" name="${name}">${escapeHtml(value)}</textarea></div>`;
const formActions = (label = "Guardar cambios") => `<div class="form-actions"><button type="button" class="button button-neutral" data-action="close-dialog">Cancelar</button><button type="submit" class="button button-primary">${escapeHtml(label)}</button></div>`;
const checked = (value) => value ? "checked" : "";
const numberOrNull = (form, key) => form.get(key) === "" ? null : Number(form.get(key));
const textOrNull = (form, key) => String(form.get(key) || "").trim() || null;

const brandForm = (brand = null) => showDialog(brand ? "Editar marca" : "Nueva marca",
    `<form><div class="form-grid">${field("Nombre", "nombre", brand?.nombre, "text", "required maxlength=100")}${textArea("Descripción", "descripcion", brand?.descripcion)}</div><label class="check-row"><input type="checkbox" name="estado" ${checked(brand ? brand.estado : true)}> Marca activa</label>${formActions(brand ? "Guardar marca" : "Crear marca")}</form>`,
    async (form) => {
        const body = { nombre: String(form.get("nombre")).trim(), descripcion: textOrNull(form, "descripcion"), estado: form.has("estado") };
        await send(brand ? `/api/admin/marcas/${brand.id_marca}` : "/api/admin/marcas", brand ? "PATCH" : "POST", body);
        toast(brand ? "Marca actualizada" : "Marca creada");
    });

const categoryForm = (category = null) => {
    const parents = state.categories.filter((c) => c.estado && c.id_categoria !== category?.id_categoria);
    showDialog(category ? "Editar categoría" : "Nueva categoría", `<form><div class="form-grid">${field("Nombre", "nombre", category?.nombre, "text", "required maxlength=100")}${field("Slug", "slug", category?.slug, "text", "required maxlength=120 pattern='[a-z0-9]+(-[a-z0-9]+)*'")}<div class="field field-full"><label for="f-parent">Categoría padre</label><select id="f-parent" name="id_categoria_padre"><option value="">Ninguna · categoría raíz</option>${parents.map((c) => `<option value="${Number(c.id_categoria)}" ${category?.id_categoria_padre === c.id_categoria ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`).join("")}</select></div>${textArea("Descripción", "descripcion", category?.descripcion)}</div><label class="check-row"><input type="checkbox" name="estado" ${checked(category ? category.estado : true)}> Categoría activa</label>${formActions(category ? "Guardar categoría" : "Crear categoría")}</form>`, async (form) => {
        const body = { nombre: String(form.get("nombre")).trim(), slug: String(form.get("slug")).trim(), id_categoria_padre: numberOrNull(form, "id_categoria_padre"), descripcion: textOrNull(form, "descripcion"), estado: form.has("estado") };
        await send(category ? `/api/admin/categorias/${category.id_categoria}` : "/api/admin/categorias", category ? "PATCH" : "POST", body);
        toast(category ? "Categoría actualizada" : "Categoría creada");
    });
    const name = $("#f-nombre"), slug = $("#f-slug");
    if (!category) name.addEventListener("input", () => { if (!slug.dataset.edited) slug.value = slugify(name.value); });
    slug.addEventListener("input", () => { slug.dataset.edited = "true"; });
};

const productForm = async (product = null) => {
    await refreshChoices();
    const brandOptions = state.brands.filter((b) => b.estado || b.id_marca === product?.id_marca)
        .map((b) => `<option value="${Number(b.id_marca)}" ${product?.id_marca === b.id_marca ? "selected" : ""}>${escapeHtml(b.nombre)}</option>`).join("");
    const categoryOptions = state.categories.filter((c) => c.estado || product?.categoria_ids?.includes(c.id_categoria))
        .map((c) => `<label class="choice"><input type="checkbox" name="categoria_ids" value="${Number(c.id_categoria)}" ${checked(product?.categoria_ids?.includes(c.id_categoria))}>${escapeHtml(c.nombre)}</label>`).join("");
    showDialog(product ? "Editar producto" : "Nuevo producto", `<form><div class="form-grid">${field("Nombre del producto", "nombre", product?.nombre, "text", "required maxlength=150")}${field("Slug de URL", "slug", product?.slug, "text", "required maxlength=170 pattern='[a-z0-9]+(-[a-z0-9]+)*'")}<div class="field"><label for="f-id_marca">Marca</label><select id="f-id_marca" name="id_marca"><option value="">Sin marca</option>${brandOptions}</select></div><div class="field"><label for="f-estado">Estado</label><select id="f-estado" name="estado">${["ACTIVO", "INACTIVO", "AGOTADO", "DESCONTINUADO"].map((s) => `<option value="${s}" ${s === (product?.estado || "ACTIVO") ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field field-full"><label>Categorías</label><div class="choice-grid">${categoryOptions || '<span class="form-hint">Crea una categoría antes de añadir productos.</span>'}</div></div>${textArea("Descripción corta", "descripcion_corta", product?.descripcion_corta)}${textArea("Descripción detallada", "descripcion_larga", product?.descripcion_larga)}</div><label class="check-row"><input type="checkbox" name="destacado" ${checked(product?.destacado)}> Destacar en el catálogo</label><label class="check-row"><input type="checkbox" name="requiere_receta" ${checked(product?.requiere_receta)}> Requiere receta</label>${formActions(product ? "Guardar producto" : "Crear producto")}</form>`, async (form) => {
        const categories = form.getAll("categoria_ids").map(Number);
        if (!categories.length) throw new Error("Selecciona al menos una categoría");
        const body = { nombre: String(form.get("nombre")).trim(), slug: String(form.get("slug")).trim(), id_marca: numberOrNull(form, "id_marca"), categoria_ids: categories, estado: form.get("estado"), descripcion_corta: textOrNull(form, "descripcion_corta"), descripcion_larga: textOrNull(form, "descripcion_larga"), destacado: form.has("destacado"), requiere_receta: form.has("requiere_receta") };
        await send(product ? `/api/admin/productos/${product.id_producto}` : "/api/admin/productos", product ? "PATCH" : "POST", body);
        toast(product ? "Producto actualizado" : "Producto creado. Ahora añade una variante y una imagen.");
    });
    const name = $("#f-nombre"), slug = $("#f-slug");
    if (!product) name.addEventListener("input", () => { if (!slug.dataset.edited) slug.value = slugify(name.value); });
    slug.addEventListener("input", () => { slug.dataset.edited = "true"; });
};

const productDetail = async (id) => {
    const { data: p } = await api(`/api/admin/productos/${id}`);
    const variantRows = p.variantes.map((v) => `<div class="detail-item"><div><strong>${escapeHtml(v.nombre_variante)}</strong><small>${escapeHtml(v.sku)} · ${money(v.precio_oferta ?? v.precio)} · ${Number(v.stock_actual || 0) - Number(v.stock_reservado || 0)} disponibles (${Number(v.stock_reservado || 0)} reservados)</small></div><button class="row-button" data-action="edit-variant" data-id="${Number(v.id_variante)}" data-product="${Number(id)}">Editar</button></div>`).join("");
    const imageRows = p.imagenes.map((i) => `<div class="detail-item"><div class="detail-item-main"><img src="${escapeHtml(safeImage(i.url_imagen) || "")}" alt=""><div><strong>${i.es_principal ? "Principal" : "Imagen adicional"}</strong><small>${escapeHtml(i.texto_alternativo || i.url_imagen)}</small></div></div><div class="row-actions"><button class="row-button" data-action="edit-image" data-id="${Number(i.id_imagen)}" data-product="${Number(id)}">Editar</button><button class="row-button danger" data-action="delete-image" data-id="${Number(i.id_imagen)}" data-product="${Number(id)}">Quitar</button></div></div>`).join("");
    showDialog(p.nombre, `<p class="form-hint">${escapeHtml(p.slug)} · ${escapeHtml(p.marca || "Sin marca")}</p><button class="button button-secondary" data-action="edit-product" data-id="${Number(id)}">Editar datos del producto</button><div class="section-divider"></div><section class="detail-section"><div class="detail-header"><h3>Variantes (${p.variantes.length})</h3><button class="row-button" data-action="new-variant" data-product="${Number(id)}">+ Añadir variante</button></div><div class="detail-list">${variantRows || empty("Sin variantes", "Añade una variante con precio para vender este producto.")}</div></section><div class="section-divider"></div><section class="detail-section"><div class="detail-header"><h3>Imágenes (${p.imagenes.length})</h3><button class="row-button" data-action="new-image" data-product="${Number(id)}">+ Añadir imagen</button></div><div class="detail-list">${imageRows || empty("Sin imágenes", "Añade una URL HTTPS para mostrar el producto.")}</div></section>`);
};

const variantForm = (productId, variant = null) => showDialog(variant ? "Editar variante" : "Nueva variante",
    `<form><div class="form-grid">${field("SKU", "sku", variant?.sku, "text", "required maxlength=60")}${field("Nombre de variante", "nombre_variante", variant?.nombre_variante, "text", "required maxlength=120")}${field("Precio regular (S/)", "precio", variant?.precio, "number", "required min=0.01 step=0.01")}${field("Precio oferta (S/)", "precio_oferta", variant?.precio_oferta, "number", "min=0 step=0.01")}${field("Presentación", "presentacion", variant?.presentacion)}${field("Unidad de medida", "unidad_medida", variant?.unidad_medida)}${variant ? "" : field("Stock mínimo", "stock_minimo", 0, "number", "min=0 step=1")}</div><label class="check-row"><input type="checkbox" name="activo" ${checked(variant ? variant.activo : true)}> Variante activa</label><p class="form-hint">El stock físico se modifica desde Inventario; no cambia al editar una variante.</p>${formActions(variant ? "Guardar variante" : "Crear variante")}</form>`,
    async (form) => {
        const body = { sku: String(form.get("sku")).trim(), nombre_variante: String(form.get("nombre_variante")).trim(), precio: Number(form.get("precio")), precio_oferta: numberOrNull(form, "precio_oferta"), presentacion: textOrNull(form, "presentacion"), unidad_medida: textOrNull(form, "unidad_medida"), activo: form.has("activo") };
        if (!variant) body.stock_minimo = Number(form.get("stock_minimo") || 0);
        await send(variant ? `/api/admin/variantes/${variant.id_variante}` : `/api/admin/productos/${productId}/variantes`, variant ? "PATCH" : "POST", body);
        toast(variant ? "Variante actualizada" : "Variante creada. Registra su stock en Inventario.");
    });

const imageForm = (productId, image = null) => showDialog(image ? "Editar imagen" : "Nueva imagen",
    `<form><div class="form-grid">${field("URL HTTPS", "url_imagen", image?.url_imagen, "url", "required maxlength=500")}${field("Texto alternativo", "texto_alternativo", image?.texto_alternativo)}${field("Orden visual", "orden_visual", image?.orden_visual || 1, "number", "min=1 step=1")}</div><label class="check-row"><input type="checkbox" name="es_principal" ${checked(image?.es_principal)}> Imagen principal</label><p class="form-hint">Usa una URL HTTPS pública. La primera imagen se convierte automáticamente en principal.</p>${formActions(image ? "Guardar imagen" : "Añadir imagen")}</form>`,
    async (form) => {
        const body = { url_imagen: String(form.get("url_imagen")).trim(), texto_alternativo: textOrNull(form, "texto_alternativo"), orden_visual: Number(form.get("orden_visual")), es_principal: form.has("es_principal") };
        await send(image ? `/api/admin/imagenes/${image.id_imagen}` : `/api/admin/productos/${productId}/imagenes`, image ? "PATCH" : "POST", body);
        toast(image ? "Imagen actualizada" : "Imagen añadida");
    });

const stockForm = (item) => showDialog("Ajustar inventario", `<form><p class="form-hint"><strong>${escapeHtml(item.producto)} · ${escapeHtml(item.sku)}</strong><br>Físico: ${Number(item.stock_actual)} · Reservado: ${Number(item.stock_reservado)} · Disponible: ${Number(item.stock_disponible)}</p><div class="form-grid">${field("Variación (positiva o negativa)", "cantidad", "", "number", "required step=1")}${field("Motivo del ajuste", "motivo", "", "text", "required minlength=5 maxlength=255")}</div><p class="form-hint">No se permitirá bajar el stock físico por debajo del reservado. El movimiento quedará registrado.</p>${formActions("Registrar ajuste")}</form>`, async (form) => {
    await send(`/api/admin/inventario/${item.id_variante}/ajustes`, "POST", { cantidad: Number(form.get("cantidad")), motivo: String(form.get("motivo")).trim() });
    toast("Inventario ajustado correctamente");
});
const settingsForm = (item) => showDialog("Configurar inventario", `<form><p class="form-hint">${escapeHtml(item.producto)} · ${escapeHtml(item.sku)}</p><div class="form-grid">${field("Stock mínimo", "stock_minimo", item.stock_minimo, "number", "required min=0 step=1")}${field("Ubicación en almacén", "ubicacion_almacen", item.ubicacion_almacen)}</div>${formActions()}</form>`, async (form) => {
    await send(`/api/admin/inventario/${item.id_variante}`, "PATCH", { stock_minimo: Number(form.get("stock_minimo")), ubicacion_almacen: textOrNull(form, "ubicacion_almacen") });
    toast("Configuración actualizada");
});
const movements = async (id) => {
    const result = await api(`/api/admin/inventario/${id}/movimientos`);
    showDialog("Historial de movimientos", `<p class="form-hint">Últimos 50 movimientos de la variante ${Number(id)}.</p><div class="detail-list">${result.data.map((m) => `<div class="detail-item"><div><strong>${escapeHtml(m.tipo_movimiento)}</strong><small>${escapeHtml(m.motivo || "Sin motivo")} · ${new Date(m.fecha_movimiento).toLocaleString("es-PE")}</small></div><span class="list-meta">${Number(m.stock_anterior)} → ${Number(m.stock_nuevo)} (${Number(m.cantidad)})</span></div>`).join("") || empty("Sin movimientos", "Aún no se han registrado cambios de stock.")}</div>`);
};

let searchTimer;
$("#page-content").addEventListener("input", (event) => {
    const filter = event.target.dataset.filter;
    if (!filter || !filter.endsWith("search")) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        if (filter === "product-search") { state.products.search = event.target.value.trim(); state.products.page = 1; }
        if (filter === "inventory-search") { state.inventory.search = event.target.value.trim(); state.inventory.page = 1; }
        navigate(state.page);
    }, 350);
});
$("#page-content").addEventListener("change", (event) => {
    if (event.target.dataset.filter === "product-state") { state.products.estado = event.target.value; state.products.page = 1; navigate("productos"); }
    if (event.target.dataset.filter === "inventory-low") { state.inventory.bajo_minimo = event.target.value; state.inventory.page = 1; navigate("inventario"); }
});

const handleAction = async (action, element) => {
    const id = Number(element.dataset.id), productId = Number(element.dataset.product);
    if (action === "nav") return navigate(element.dataset.page);
    if (action === "close-dialog") return $("#editor-dialog").close();
    if (action === "new-brand") return brandForm();
    if (action === "edit-brand") return brandForm(state.brands.find((x) => x.id_marca === id));
    if (action === "new-category") return categoryForm();
    if (action === "edit-category") return categoryForm(state.categories.find((x) => x.id_categoria === id));
    if (action === "new-product") return productForm();
    if (action === "view-product") return productDetail(id);
    if (action === "edit-product") { const { data } = await api(`/api/admin/productos/${id}`); $("#editor-dialog").close(); return productForm(data); }
    if (action === "new-variant") { $("#editor-dialog").close(); return variantForm(productId); }
    if (action === "edit-variant") { const { data } = await api(`/api/admin/productos/${productId}`); $("#editor-dialog").close(); return variantForm(productId, data.variantes.find((x) => x.id_variante === id)); }
    if (action === "new-image") { $("#editor-dialog").close(); return imageForm(productId); }
    if (action === "edit-image") { const { data } = await api(`/api/admin/productos/${productId}`); $("#editor-dialog").close(); return imageForm(productId, data.imagenes.find((x) => x.id_imagen === id)); }
    if (action === "delete-image") {
        if (!window.confirm("¿Quitar esta imagen del producto?")) return;
        await api(`/api/admin/imagenes/${id}`, { method: "DELETE" });
        $("#editor-dialog").close(); toast("Imagen eliminada"); await navigate(state.page); return;
    }
    if (["adjust-stock", "inventory-settings", "movements"].includes(action)) {
        if (action === "movements") return movements(id);
        const q = new URLSearchParams({ page: state.inventory.page, limit: 12 });
        if (state.inventory.search) q.set("search", state.inventory.search);
        if (state.inventory.bajo_minimo) q.set("bajo_minimo", state.inventory.bajo_minimo);
        const result = await api(`/api/admin/inventario?${q}`);
        const item = result.data.find((x) => x.id_variante === id);
        if (!item) throw new Error("Recarga el inventario e inténtalo de nuevo");
        return action === "adjust-stock" ? stockForm(item) : settingsForm(item);
    }
    if (action === "page") {
        const target = element.dataset.list === "products" ? state.products : state.inventory;
        target.page += Number(element.dataset.direction);
        return navigate(state.page);
    }
};
const delegate = async (event) => {
    const element = event.target.closest("[data-action]");
    if (!element) return;
    try { await handleAction(element.dataset.action, element); }
    catch (error) { toast(error.message, true); }
};
$("#page-content").addEventListener("click", delegate);
$("#page-actions").addEventListener("click", delegate);
$("#dialog-body").addEventListener("click", delegate);
$("#close-dialog").addEventListener("click", () => $("#editor-dialog").close());
$("#editor-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$("#menu-button").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebar-backdrop").hidden = false; });
$("#sidebar-backdrop").addEventListener("click", closeSidebar);
$("#logout-button").addEventListener("click", () => logout());
document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.page)));
$("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const errorBox = $("#login-error");
    errorBox.hidden = true; button.disabled = true;
    try {
        const { data } = await send("/api/admin/auth/login", "POST", {
            correo: form.elements.namedItem("correo").value.trim(),
            password: form.elements.namedItem("password").value
        });
        state.token = data.accessToken;
        sessionStorage.setItem("petshop.adminToken", state.token);
        form.reset(); enter(data.usuario);
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
    finally { button.disabled = false; }
});

if (state.token) {
    api("/api/admin/auth/perfil").then(({ data }) => enter(data)).catch(() => logout());
}
