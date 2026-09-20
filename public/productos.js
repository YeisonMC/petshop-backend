const productosContainer = document.querySelector("#productos");
const estadoContainer = document.querySelector("#estado");
const resumen = document.querySelector("#resumen");
const actualizarButton = document.querySelector("#actualizar");
const productoTemplate = document.querySelector("#producto-template");

const currencyFormatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
});

const formatPrice = (price) => (
    price === null ? "Precio no disponible" : currencyFormatter.format(price)
);

const showImagePlaceholder = (image, placeholder) => {
    image.hidden = true;
    placeholder.classList.add("is-visible");
};

const createProductCard = (product) => {
    const card = productoTemplate.content.cloneNode(true);
    const image = card.querySelector(".product-image");
    const placeholder = card.querySelector(".product-placeholder");
    const offerBadge = card.querySelector(".offer-badge");
    const regularPrice = card.querySelector(".product-regular-price");
    const stockBadge = card.querySelector(".product-stock");
    const detailLink = card.querySelector(".product-detail");

    card.querySelector(".product-brand").textContent = product.marca || "Sin marca";
    card.querySelector(".product-name").textContent = product.nombre;
    card.querySelector(".product-description").textContent = (
        product.descripcion_corta || "Sin descripción disponible"
    );
    card.querySelector(".product-price").textContent = formatPrice(product.precio_desde);

    if (product.imagen_principal) {
        image.src = product.imagen_principal;
        image.alt = product.nombre;
        image.addEventListener("error", () => {
            showImagePlaceholder(image, placeholder);
        }, { once: true });
    } else {
        showImagePlaceholder(image, placeholder);
    }

    if (product.tiene_oferta) {
        offerBadge.textContent = "Oferta";
        regularPrice.textContent = formatPrice(product.precio_regular_desde);
    } else {
        offerBadge.textContent = "";
        regularPrice.textContent = "";
    }

    stockBadge.textContent = product.disponible
        ? `${product.stock_disponible} disponibles`
        : "Sin stock";
    stockBadge.classList.add(product.disponible ? "text-bg-success" : "text-bg-secondary");

    detailLink.href = `/api/productos/${encodeURIComponent(product.slug)}`;
    detailLink.setAttribute("aria-label", `Ver respuesta del detalle de ${product.nombre}`);

    return card;
};

const showLoading = () => {
    actualizarButton.disabled = true;
    productosContainer.replaceChildren();
    estadoContainer.className = "text-center py-5";
    estadoContainer.innerHTML = `
        <div class="spinner-border text-primary" aria-hidden="true"></div>
        <p class="mt-3 mb-0">Cargando productos...</p>
    `;
};

const showError = (message) => {
    estadoContainer.className = "alert alert-danger";
    estadoContainer.textContent = message;
    resumen.textContent = "No se pudo consultar el catálogo.";
};

const loadProducts = async () => {
    showLoading();

    try {
        const response = await fetch("/api/productos?limit=12", {
            headers: { Accept: "application/json" }
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.error?.message || "La API devolvió un error");
        }

        estadoContainer.className = "d-none";
        resumen.textContent = `${payload.data.length} de ${payload.pagination.total} productos mostrados`;

        if (payload.data.length === 0) {
            estadoContainer.className = "alert alert-info";
            estadoContainer.textContent = "No hay productos disponibles por el momento.";
            return;
        }

        const cards = document.createDocumentFragment();
        payload.data.forEach((product) => {
            cards.append(createProductCard(product));
        });
        productosContainer.append(cards);
    } catch (error) {
        showError(`No fue posible cargar los productos: ${error.message}`);
    } finally {
        actualizarButton.disabled = false;
    }
};

actualizarButton.addEventListener("click", loadProducts);
loadProducts();
