// script.js
// Lógica principal del marketplace CRUD con Firestore y ImgBB
import { db, userId } from './firebase-config.js';
import {
  collection, addDoc, getDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, orderBy, query
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- Configuración ---
// Reemplaza 'YOUR_IMGBB_API_KEY' con tu propia clave de ImgBB
const IMGBB_API_KEY = 'YOUR_IMGBB_API_KEY';
// appId para la colección pública
const appId = 'ropa-indie-chic';
const productsCollection = collection(db, `artifacts/${appId}/public/data/products`);

// --- Referencias a elementos del DOM ---
const productsGrid = document.getElementById('products-grid');
const openManagementBtn = document.getElementById('open-management-btn');
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
const alertModal = document.getElementById('custom-alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const confirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

let editingProductId = null;
let selectedProductId = null;

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
    renderProducts(products);
  }, error => {
    showCustomAlert('Error al cargar productos: ' + error.message);
  });
}

// --- Crear o Actualizar Producto (CREATE/UPDATE) ---
async function addOrUpdateProduct(e) {
  e.preventDefault();
  saveProductButton.disabled = true;
  try {
    const name = productNameInput.value.trim();
    const description = productDescriptionInput.value.trim();
    const price = parseFloat(productPriceInput.value);
    let imageUrl = productImageUrlInput.value.trim();
    // Subida de imagen si hay archivo
    if (productImageFileInput.files[0]) {
      const uploadedUrl = await uploadImageToImgBB(productImageFileInput.files[0]);
      if (!uploadedUrl) throw new Error('No se pudo subir la imagen');
      imageUrl = uploadedUrl;
    }
    if (!name || !description || isNaN(price) || price < 0) {
      await showCustomAlert('Por favor, completa todos los campos correctamente.');
      return;
    }
    if (!imageUrl) {
      await showCustomAlert('Debes proporcionar una URL de imagen o subir un archivo.');
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
    editingProductId = null;
    saveProductButton.textContent = 'Guardar Prenda';
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
  renderProducts(Array.from(document.querySelectorAll('.product-card')).map(card => ({
    id: card.querySelector('.select-button').dataset.id,
    name: card.querySelector('h3').textContent,
    description: card.querySelector('p').textContent,
    price: card.querySelector('.price').textContent.replace('$',''),
    imageUrl: card.querySelector('img').src
  })));
  showCustomAlert('¡Has seleccionado la prenda!');
}

// --- Event Listeners Iniciales ---
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
});
openManagementBtn.addEventListener('click', () => {
  managementSection.classList.toggle('hidden');
});
productForm.addEventListener('submit', addOrUpdateProduct);
alertOkBtn.addEventListener('click', () => {
  alertModal.classList.add('hidden');
});
confirmYesBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
});
confirmNoBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
}); 