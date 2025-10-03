// script.js
// Lógica principal del marketplace CRUD con Firestore y ImgBB
import { db, userId } from './firebase-config.js';
import {
  collection, addDoc, getDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, orderBy, query
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- Configuración ---
// Reemplaza 'YOUR_IMGBB_API_KEY' con tu propia clave de ImgBB
const IMGBB_API_KEY = 'ce99b1421b97fd3dfee0f4359cafa5f6';
// appId para la colección pública
const appId = 'ropa-indie-chic';
const productsCollection = collection(db, `artifacts/${appId}/public/data/products`);

// --- Referencias a elementos del DOM ---
const productsGrid = document.getElementById('products-grid');
const openManagementBtn = document.getElementById('open-management-btn');
const closeManagementBtn = document.getElementById('close-management-btn');
const managementSection = document.getElementById('management-section');
const productForm = document.getElementById('product-form');
const productNameInput = document.getElementById('product-name');
const productDescriptionInput = document.getElementById('product-description');
const productPriceInput = document.getElementById('product-price');
const productImageUrlInput = document.getElementById('product-image-url');
const productImageFileInput = document.getElementById('product-image-file');
const imageUploadLoading = document.getElementById('image-upload-loading');
const saveProductButton = document.getElementById('save-product-button');
const managementTableBody = document.querySelector('#management-table tbody');
const multiProductFormContainer = document.getElementById('multi-product-form-container');
const alertModal = document.getElementById('custom-alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const confirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

let editingProductId = null;
let selectedProductId = null;
let selectedFiles = [];

// --- Utilidades de Modales Personalizados ---
function showCustomAlert(message) {
  alertMessage.textContent = message;
  alertModal.classList.remove('hidden');
  return new Promise(resolve => {
    alertOkBtn.onclick = () => {
      alertModal.classList.add('hidden');
      resolve();
    };
  });
}

function showCustomConfirm(message) {
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
  return new Promise(resolve => {
    confirmYesBtn.onclick = () => {
      confirmModal.classList.add('hidden');
      resolve(true);
    };
    confirmNoBtn.onclick = () => {
      confirmModal.classList.add('hidden');
      resolve(false);
    };
  });
}

// --- Subida de Imagen a ImgBB ---
async function uploadImageToImgBB(file) {
  imageUploadLoading.classList.remove('hidden');
  try {
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', file);
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Error al subir la imagen');
    return data.data.url;
  } catch (error) {
    await showCustomAlert('Error al subir la imagen: ' + error.message);
    return null;
  } finally {
    imageUploadLoading.classList.add('hidden');
  }
}

// --- Renderizado de Productos ---
function renderProducts(products) {
  console.log('Intentando renderizar productos:', products); // Mensaje de depuración
  // Limpiar grid y tabla
  productsGrid.innerHTML = '';
  managementTableBody.innerHTML = '';
  products.forEach(product => {
    // Tarjeta en el grid
    const card = document.createElement('div');
    card.className = 'product-card' + (selectedProductId === product.id ? ' selected' : '');
    card.innerHTML = `
      <img src="${product.imageUrl || 'https://placehold.co/200x150/FF69B4/FFFFFF?text=Prenda+Indie'}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p class="price">$${Number(product.price).toFixed(2)}</p>
      <button class="select-button${selectedProductId === product.id ? ' selected' : ''}" data-id="${product.id}">
        ${selectedProductId === product.id ? 'Seleccionado' : 'Seleccionar'}
      </button>
    `;
    productsGrid.appendChild(card);
    // Listener para seleccionar
    card.querySelector('.select-button').onclick = () => handleSelectProduct(product.id);
    // Fila en la tabla de gestión
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.name}</td>
      <td>$${Number(product.price).toFixed(2)}</td>
      <td>
        <button class="edit-btn" data-id="${product.id}">Editar</button>
        <button class="delete-btn" data-id="${product.id}">Eliminar</button>
      </td>
    `;
    // Listeners para editar y eliminar
    row.querySelector('.edit-btn').onclick = () => editProduct(product.id);
    row.querySelector('.delete-btn').onclick = () => deleteProduct(product.id);
    managementTableBody.appendChild(row);
  });
}

// --- Carga y Escucha de Productos (READ) ---
function loadProducts() {
  // Escucha en tiempo real con onSnapshot
  const q = query(productsCollection, orderBy('name'));
  onSnapshot(q, snapshot => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('Datos recibidos de Firestore:', products); // Mensaje de depuración
    renderProducts(products);
  }, error => {
    showCustomAlert('Error al cargar productos: ' + error.message);
  });
}

// --- Manejo de Selección de Múltiples Archivos ---
function handleFileSelect(event) {
  selectedFiles = Array.from(event.target.files);
  multiProductFormContainer.innerHTML = ''; // Limpiar el contenedor

  if (selectedFiles.length > 1) {
    // Deshabilitar el formulario principal si hay más de un archivo para evitar confusiones
    productNameInput.disabled = true;
    productDescriptionInput.disabled = true;
    productPriceInput.disabled = true;
    productImageUrlInput.disabled = true;

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const formHtml = `
          <div class="multi-product-item" data-index="${index}">
            <img src="${e.target.result}" alt="Previsualización de ${file.name}" class="thumbnail-preview">
            <div class="multi-product-inputs">
              <label>Nombre:</label>
              <input type="text" class="multi-product-name" required placeholder="${file.name}">
              <label>Descripción:</label>
              <textarea class="multi-product-description" required></textarea>
              <label>Precio:</label>
              <input type="number" class="multi-product-price" step="0.01" min="0" required>
            </div>
          </div>
        `;
        multiProductFormContainer.innerHTML += formHtml;
      };
      reader.readAsDataURL(file);
    });
    saveProductButton.textContent = `Guardar ${selectedFiles.length} Prendas`;
  } else {
    // Habilitar el formulario principal si solo hay un archivo o ninguno
    productNameInput.disabled = false;
    productDescriptionInput.disabled = false;
    productPriceInput.disabled = false;
    productImageUrlInput.disabled = false;
    saveProductButton.textContent = 'Guardar Prenda';
  }
}

// --- Crear o Actualizar Producto (CREATE/UPDATE) ---
async function addOrUpdateProduct(e) {
  e.preventDefault();
  saveProductButton.disabled = true;

  // Lógica para subida múltiple
  if (selectedFiles.length > 1) {
    try {
      const productForms = document.querySelectorAll('.multi-product-item');
      let allProductsValid = true;
      const productsToCreate = [];

      for (const form of productForms) {
        const name = form.querySelector('.multi-product-name').value.trim();
        const description = form.querySelector('.multi-product-description').value.trim();
        const price = parseFloat(form.querySelector('.multi-product-price').value);

        if (!name || !description || isNaN(price) || price < 0) {
          allProductsValid = false;
          break;
        }
        productsToCreate.push({ name, description, price });
      }

      if (!allProductsValid) {
        await showCustomAlert('Por favor, completa todos los campos de todas las prendas correctamente.');
        saveProductButton.disabled = false;
        return;
      }

      imageUploadLoading.classList.remove('hidden');
      for (let i = 0; i < productsToCreate.length; i++) {
        const file = selectedFiles[i];
        const productData = productsToCreate[i];
        const imageUrl = await uploadImageToImgBB(file);
        if (!imageUrl) {
          throw new Error(`No se pudo subir la imagen para ${productData.name}`);
        }
        await addDoc(productsCollection, { ...productData, imageUrl });
      }

      await showCustomAlert(`${productsToCreate.length} prendas añadidas correctamente.`);
      productForm.reset();
      multiProductFormContainer.innerHTML = '';
      selectedFiles = [];
      handleFileSelect({ target: { files: [] } }); // Resetear la vista del formulario

    } catch (error) {
      await showCustomAlert('Error al guardar las prendas: ' + error.message);
    } finally {
      imageUploadLoading.classList.add('hidden');
      saveProductButton.disabled = false;
    }
    return; // Terminar la ejecución para subida múltiple
  }

  // Lógica original para un solo producto (crear o actualizar)
  try {
    const name = productNameInput.value.trim();
    const description = productDescriptionInput.value.trim();
    const price = parseFloat(productPriceInput.value);
    let imageUrl = productImageUrlInput.value.trim();

    // Subida de imagen si hay archivo
    if (productImageFileInput.files[0] && selectedFiles.length === 1) {
        const uploadedUrl = await uploadImageToImgBB(productImageFileInput.files[0]);
        if (!uploadedUrl) throw new Error('No se pudo subir la imagen');
        imageUrl = uploadedUrl;
    }

    if (!name || !description || isNaN(price) || price < 0) {
      await showCustomAlert('Por favor, completa todos los campos correctamente.');
      saveProductButton.disabled = false;
      return;
    }
    if (!imageUrl && !editingProductId) { // Solo requerir imagen si es un producto nuevo
      await showCustomAlert('Debes proporcionar una URL de imagen o subir un archivo.');
      saveProductButton.disabled = false;
      return;
    }

    const productData = { name, description, price, imageUrl };

    if (editingProductId) {
      // Actualizar
      await updateDoc(doc(db, productsCollection.path, editingProductId), productData);
      await showCustomAlert('Prenda actualizada correctamente.');
    } else {
      // Crear
      await addDoc(productsCollection, productData);
      await showCustomAlert('Prenda añadida correctamente.');
    }

    // Limpiar formulario
    productForm.reset();
    multiProductFormContainer.innerHTML = '';
    selectedFiles = [];
    editingProductId = null;
    saveProductButton.textContent = 'Guardar Prenda';
    handleFileSelect({ target: { files: [] } }); // Resetear la vista del formulario
  } catch (error) {
    await showCustomAlert('Error al guardar: ' + error.message);
  } finally {
    saveProductButton.disabled = false;
  }
}
// --- Precarga para Edición (UPDATE) ---
async function editProduct(id) {
  try {
    const docRef = doc(db, productsCollection.path, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Producto no encontrado');
    const product = docSnap.data();
    productNameInput.value = product.name;
    productDescriptionInput.value = product.description;
    productPriceInput.value = product.price;
    productImageUrlInput.value = product.imageUrl || '';
    productImageFileInput.value = '';
    editingProductId = id;
    saveProductButton.textContent = 'Actualizar Prenda';
    managementSection.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    await showCustomAlert('Error al cargar producto: ' + error.message);
  }
}

// --- Eliminar Producto (DELETE) ---
async function deleteProduct(id) {
  try {
    const confirmed = await showCustomConfirm('¿Estás seguro de que quieres eliminar esta prenda?');
    if (!confirmed) return;
    await deleteDoc(doc(db, productsCollection.path, id));
    await showCustomAlert('Prenda eliminada correctamente.');
  } catch (error) {
    await showCustomAlert('Error al eliminar: ' + error.message);
  }
}

// --- Selección de Producto ---
function handleSelectProduct(id) {
  selectedProductId = id;
  // Re-render all products to update the 'selected' state visually
  const allProducts = Array.from(document.querySelectorAll('.product-card')).map(card => ({
    id: card.querySelector('.select-button').dataset.id,
    name: card.querySelector('h3').textContent,
    description: card.querySelector('p:not(.price)').textContent,
    price: card.querySelector('.price').textContent.replace('$', ''),
    imageUrl: card.querySelector('img').src
  }));
  renderProducts(allProducts);
  showCustomAlert('¡Has seleccionado la prenda!');
}

// --- Event Listeners Iniciales ---
document.addEventListener('DOMContentLoaded', () => {
  // Comprobar si la API key de ImgBB está configurada
  if (IMGBB_API_KEY === 'YOUR_IMGBB_API_KEY' || !IMGBB_API_KEY) {
    console.warn('La API Key de ImgBB no está configurada. La subida de imágenes está deshabilitada.');
    productImageFileInput.disabled = true;
    const label = document.querySelector('label[for="product-image-file"]');
    if (label) {
      label.innerHTML += ' <span style="color:red;">(API Key no configurada)</span>';
    }
  }
});

loadProducts(); // Llamar a la función directamente al final del script

openManagementBtn.addEventListener('click', () => {
  managementSection.classList.remove('hidden');
});

closeManagementBtn.addEventListener('click', () => {
  managementSection.classList.add('hidden');
});

productForm.addEventListener('submit', addOrUpdateProduct);
productImageFileInput.addEventListener('change', handleFileSelect);

alertOkBtn.addEventListener('click', () => {
  alertModal.classList.add('hidden');
});

confirmYesBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
});

confirmNoBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
}); 