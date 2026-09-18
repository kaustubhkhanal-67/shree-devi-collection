const toast = document.querySelector('.toast');
let toastTimer;
function showToast(message){ toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove('show'),2600); }
const cart = [];
const bagDrawer = document.querySelector('.bag-drawer');
const bagOverlay = document.querySelector('.bag-overlay');
const bagItems = document.querySelector('.bag-items');
function renderBag(){
  const count = cart.reduce((sum,item) => sum + item.qty, 0);
  document.querySelector('.bag-count').textContent = count;
  if (!cart.length) { bagItems.innerHTML = '<p class="bag-empty">Your bag is waiting for something lovely.</p>'; document.querySelector('.bag-total').textContent = 'Rs. 0'; return; }
  bagItems.innerHTML = cart.map((item,index) => `<div class="bag-item"><div class="bag-item-info"><b>${item.name}</b><small>${item.detail}</small></div><div class="bag-item-controls"><button type="button" data-cart-action="minus" data-cart-index="${index}">−</button><strong>${item.qty}</strong><button type="button" data-cart-action="plus" data-cart-index="${index}">+</button></div></div>`).join('');
  document.querySelector('.bag-total').textContent = `Rs. ${cart.reduce((sum,item) => sum + item.price * item.qty, 0).toLocaleString()}`;
  bagItems.querySelectorAll('[data-cart-action]').forEach(button => button.addEventListener('click', () => { const item = cart[Number(button.dataset.cartIndex)]; item.qty += button.dataset.cartAction === 'plus' ? 1 : -1; if (item.qty <= 0) cart.splice(Number(button.dataset.cartIndex), 1); renderBag(); }));
}
function addToBag(name, price, detail){ const existing = cart.find(item => item.name === name && item.detail === detail); if (existing) existing.qty += 1; else cart.push({name,price,detail,qty:1}); renderBag(); }
function openBag(){ bagDrawer.classList.add('open'); bagOverlay.classList.add('open'); bagDrawer.setAttribute('aria-hidden','false'); }
function closeBag(){ bagDrawer.classList.remove('open'); bagOverlay.classList.remove('open'); bagDrawer.setAttribute('aria-hidden','true'); }
const checkoutModal = document.querySelector('.checkout-modal');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutCity = document.querySelector('#checkout-city');
const checkoutStreet = document.querySelector('#checkout-street');
const checkoutBhairahawa = document.querySelector('.checkout-bhairahawa');
const checkoutCod = document.querySelector('.checkout-cod');
const checkoutQr = document.querySelector('.checkout-qr');
const paymentUpload = document.querySelector('.payment-upload');
const transactionCode = document.createElement('input');
transactionCode.id = 'transaction-code';
transactionCode.name = 'transaction-code';
transactionCode.type = 'text';
transactionCode.placeholder = 'eSewa transaction code';
transactionCode.autocomplete = 'off';
transactionCode.setAttribute('aria-label','eSewa transaction code');
paymentUpload.append(' Transaction code ', transactionCode);
let paymentProofDataUrl = '';
document.querySelector('#payment-proof').addEventListener('change', () => { const file = document.querySelector('#payment-proof').files[0]; if (!file) { paymentProofDataUrl = ''; return; } const reader = new FileReader(); reader.onload = () => { paymentProofDataUrl = reader.result; }; reader.readAsDataURL(file); });
const esewaPaymentPanel = document.querySelector('.esewa-payment-panel');
const esewaQrImage = document.querySelector('.esewa-payment-panel img');
const esewaPayableAmount = document.querySelector('.esewa-payable-amount');
const esewaPayNow = document.querySelector('.esewa-pay-now');
const qrLightbox = document.createElement('div');
qrLightbox.className = 'qr-lightbox';
qrLightbox.innerHTML = '<button type="button" class="qr-lightbox-close" aria-label="Close QR code">×</button><img src="assets/esewa-qr.jpeg" alt="Full-size eSewa payment QR" />';
document.body.appendChild(qrLightbox);
function closeQrLightbox(){ qrLightbox.classList.remove('open'); }
esewaQrImage.addEventListener('click', () => qrLightbox.classList.add('open'));
qrLightbox.addEventListener('click', event => { if (event.target === qrLightbox || event.target.closest('.qr-lightbox-close')) closeQrLightbox(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeQrLightbox(); });
const codRadio = document.createElement('input');
codRadio.type = 'radio'; codRadio.name = 'checkout-payment'; codRadio.value = 'cod'; codRadio.setAttribute('aria-label','Cash on Delivery');
const qrRadio = document.createElement('input');
qrRadio.type = 'radio'; qrRadio.name = 'checkout-payment'; qrRadio.value = 'qr'; qrRadio.setAttribute('aria-label','QR payment');
checkoutCod.prepend(codRadio); checkoutQr.prepend(qrRadio);
function updateEsewaPaymentPanel(){ const total = cart.reduce((sum,item) => sum + item.price * item.qty, 0); const formattedTotal = `Rs. ${total.toLocaleString()}`; esewaPayableAmount.textContent = formattedTotal; esewaPayNow.innerHTML = `Pay ${formattedTotal} with eSewa <span>↗</span>`; esewaPayNow.setAttribute('aria-label', `Pay ${formattedTotal} with eSewa`); esewaPayNow.dataset.amount = total; esewaPaymentPanel.hidden = !qrRadio.checked || !checkoutCity.value; }
async function startEsewaPayment(event){
  event.preventDefault();
  const amount = Number(esewaPayNow.dataset.amount || 0);
  if (!amount) return;
  esewaPayNow.setAttribute('aria-busy','true');
  esewaPayNow.textContent = 'Connecting to eSewa…';
  try {
    const response = await fetch('/api/esewa/initiate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount})});
    const payment = await response.json();
    if (!response.ok) throw new Error(payment.error || 'eSewa payment could not be started.');
    const form = document.createElement('form'); form.method = 'POST'; form.action = payment.action;
    Object.entries(payment.fields).forEach(([name,value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); });
    document.body.appendChild(form); form.submit();
  } catch (error) { showToast(error.message); updateEsewaPaymentPanel(); }
  finally { esewaPayNow.removeAttribute('aria-busy'); }
}
function updatePaymentUpload(){ paymentUpload.hidden = !qrRadio.checked; updateEsewaPaymentPanel(); }
function openCheckout(){ if (!cart.length) { showToast('Your bag is empty'); return; } closeBag(); document.querySelector('.checkout-total-value').textContent = document.querySelector('.bag-total').textContent; updateEsewaPaymentPanel(); checkoutModal.classList.add('open'); checkoutModal.setAttribute('aria-hidden','false'); }
function closeCheckout(){ checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true'); }
function updateCheckoutPayment(){ const isBhairahawa = checkoutCity.value === 'Bhairahawa'; checkoutBhairahawa.hidden = !isBhairahawa; checkoutCod.hidden = !checkoutCity.value; checkoutQr.hidden = !checkoutCity.value; codRadio.disabled = !isBhairahawa; codRadio.checked = isBhairahawa; qrRadio.checked = !isBhairahawa; updatePaymentUpload(); if (!isBhairahawa) checkoutStreet.value = ''; }

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const filter = button.dataset.filter;
  document.querySelectorAll('.product-card').forEach(card => { card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none'; });
}));

document.querySelectorAll('.add-button').forEach(button => button.addEventListener('click', () => {
  if (button.classList.contains('customize-trigger') || button.classList.contains('gift-customize-trigger')) return;
  addToBag(button.dataset.product, Number(button.dataset.price || 0), button.dataset.price ? `Customized frame · Rs. ${button.dataset.price}` : 'Gift item');
  showToast(`${button.dataset.product} added to your bag`);
}));

document.querySelectorAll('.heart').forEach(button => button.addEventListener('click', () => {
  button.classList.toggle('selected');
  button.textContent = button.classList.contains('selected') ? '♥' : '♡';
  showToast(button.classList.contains('selected') ? 'Saved to your wishlist' : 'Removed from your wishlist');
}));

document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
document.querySelector('.bag-button').addEventListener('click', openBag);
document.querySelector('.bag-close').addEventListener('click', closeBag);
bagOverlay.addEventListener('click', closeBag);
document.querySelector('.bag-checkout').addEventListener('click', openCheckout);
document.querySelector('.checkout-close').addEventListener('click', closeCheckout);
document.querySelector('.checkout-done').addEventListener('click', closeCheckout);
checkoutModal.addEventListener('click', event => { if (event.target === checkoutModal) closeCheckout(); });
checkoutCity.addEventListener('change', updateCheckoutPayment);
checkoutForm.addEventListener('submit', event => { if (checkoutCity.value !== 'Bhairahawa' && !transactionCode.value.trim()) { event.preventDefault(); event.stopImmediatePropagation(); document.querySelector('.checkout-message').textContent = 'Please enter your eSewa transaction code.'; transactionCode.focus(); } }, true);
codRadio.addEventListener('change', updatePaymentUpload);
qrRadio.addEventListener('change', updatePaymentUpload);
esewaPayNow.addEventListener('click', startEsewaPayment);
checkoutForm.addEventListener('submit', event => { event.preventDefault(); const message = document.querySelector('.checkout-message'); if (!cart.length) { message.textContent = 'Your bag is empty.'; return; } if (checkoutCity.value === 'Bhairahawa' && !checkoutStreet.value) { message.textContent = 'Please choose your Bhairahawa street or chowk.'; checkoutStreet.focus(); return; } if (checkoutCity.value !== 'Bhairahawa' && !document.querySelector('#payment-proof').files.length) { message.textContent = 'Please upload your QR payment screenshot.'; document.querySelector('#payment-proof').focus(); return; } const orderNumber = `SD-${Date.now().toString().slice(-6)}`; const order = { orderNumber, createdAt:new Date().toISOString(), items:cart.map(item => ({...item})), customer:{name:document.querySelector('#checkout-name').value, phone:document.querySelector('#checkout-phone').value, email:document.querySelector('#checkout-email').value, city:checkoutCity.value, street:checkoutStreet.value, address:document.querySelector('#checkout-address').value, note:document.querySelector('#checkout-note').value}, payment:qrRadio.checked ? 'QR payment' : 'Cash on Delivery', total:cart.reduce((sum,item) => sum + item.price * item.qty, 0) }; const savedOrders = JSON.parse(localStorage.getItem('shree-devi-orders') || '[]'); savedOrders.push(order); localStorage.setItem('shree-devi-orders', JSON.stringify(savedOrders)); document.querySelector('.success-copy').textContent = `Order ${orderNumber} is received for Rs. ${order.total.toLocaleString()}. We’ll contact ${order.customer.phone} to confirm delivery to ${order.customer.city}.`; checkoutForm.hidden = true; document.querySelector('.order-success').hidden = false; cart.splice(0, cart.length); renderBag(); });
document.querySelector('.menu-button').addEventListener('click', () => { document.querySelector('.nav-links').classList.toggle('mobile-open'); showToast('Use the links above to explore'); });
document.querySelector('#newsletter-form').addEventListener('submit', event => { event.preventDefault(); event.currentTarget.querySelector('.form-message').textContent = 'Thank you — you’re on the list ✦'; event.currentTarget.reset(); });

const customizer = document.querySelector('.customizer');
const photoInput = document.querySelector('#photo-upload');
const uploadPreview = document.querySelector('.upload-preview');
const previewImage = uploadPreview.querySelector('img');
const livePreviewMat = document.querySelector('.preview-mat');
const livePreviewImage = livePreviewMat.querySelector('img');
const deliveryCity = document.querySelector('#delivery-city');
const bhairahawaStreetWrap = document.querySelector('.bhairahawa-street-wrap');
const bhairahawaStreet = document.querySelector('#bhairahawa-street');
const deliveryFields = document.querySelector('.delivery-fields');
const deliveryNote = document.querySelector('.delivery-note');
const paymentBox = document.querySelector('.payment-box');
const codMethod = document.querySelector('.cod-method');
const qrMethod = document.querySelector('.qr-method');
function updateLivePreview(){
  const selected = document.querySelector('.frame-option input:checked');
  if (!selected) return;
  const name = selected.value.toLowerCase();
  livePreviewMat.style.borderColor = name.includes('red') ? '#8b252d' : name.includes('black') ? '#24232a' : name.includes('brown') || name.includes('wood') ? '#6f442c' : '#d6d7d9';
  livePreviewMat.style.boxShadow = `inset 0 0 0 3px ${name.includes('gold') || name.includes('wood') ? '#c89b58' : '#a7a8aa'}, 0 12px 25px #6c4a4520`;
}
function setFramePrice(price){
  customizer.dataset.activePrice = price;
  document.querySelectorAll('.price-choice').forEach(choice => choice.classList.toggle('active', choice.dataset.price === price));
  document.querySelector('.selected-price').textContent = `Rs. ${price}`;
  const firstVisible = customizer.querySelector(`.frame-option:not([style*="display: none"])`);
  const visibleOptions = [...customizer.querySelectorAll('.frame-option')].filter(option => getComputedStyle(option).display !== 'none');
  if (visibleOptions.length) { visibleOptions[0].querySelector('input').checked = true; document.querySelectorAll('.frame-option').forEach(option => option.classList.toggle('selected', option.querySelector('input').checked)); updateLivePreview(); }
}
document.querySelectorAll('.price-choice').forEach(choice => choice.addEventListener('click', () => setFramePrice(choice.dataset.price)));
document.querySelectorAll('.customize-trigger').forEach(button => button.addEventListener('click', () => { setFramePrice(button.dataset.price || '450'); customizer.scrollIntoView({behavior:'smooth', block:'center'}); showToast(`Customize your Rs. ${button.dataset.price || '450'} frame`); }));
document.querySelectorAll('.frame-option input').forEach(input => input.addEventListener('change', () => { document.querySelectorAll('.frame-option').forEach(option => option.classList.toggle('selected', option.querySelector('input').checked)); updateLivePreview(); }));
photoInput.addEventListener('change', () => { const file = photoInput.files[0]; if (!file) return; if (!file.type.startsWith('image/')) { showToast('Please choose a JPG or PNG image'); photoInput.value = ''; return; } const url = URL.createObjectURL(file); previewImage.src = url; livePreviewImage.src = url; livePreviewMat.classList.add('has-photo'); uploadPreview.hidden = false; });
document.querySelector('.remove-photo').addEventListener('click', () => { photoInput.value = ''; uploadPreview.hidden = true; previewImage.removeAttribute('src'); });
document.querySelector('.remove-photo').addEventListener('click', () => { livePreviewImage.removeAttribute('src'); livePreviewMat.classList.remove('has-photo'); });
deliveryCity.addEventListener('change', () => { const city = deliveryCity.value; const isBhairahawa = city === 'Bhairahawa'; deliveryFields.hidden = !city; bhairahawaStreetWrap.hidden = !isBhairahawa; paymentBox.hidden = !city; codMethod.hidden = !isBhairahawa; qrMethod.hidden = isBhairahawa; if (!isBhairahawa) bhairahawaStreet.value = ''; deliveryNote.textContent = city ? `Great — we deliver to ${city}. Please add your contact details.${isBhairahawa ? ' Select your street or chowk too.' : ' Pay securely by QR.'}` : ''; });
document.querySelector('.customize-submit').addEventListener('click', () => { const file = photoInput.files[0]; const frame = document.querySelector('.frame-option input:checked').value; const message = document.querySelector('.customizer-message'); if (!file) { message.textContent = 'Please upload a photo first.'; photoInput.closest('.upload-box').focus(); return; } const price = Number(document.querySelector('.selected-price').textContent.replace(/[^0-9]/g,'')); addToBag(`${frame} customized frame`, price, `Rs. ${price} · Delivery details at checkout`); message.textContent = `${frame} frame added with your photo ✦`; showToast('Your customized frame is in the bag'); });
const giftCustomizer = document.querySelector('#gift-customizer');
const giftCustomizerProduct = document.querySelector('.gift-customizer-product');
const giftNote = document.querySelector('#gift-customizer-note');
const giftBasePrice = document.querySelector('.gift-base-price');
const giftAddonsPrice = document.querySelector('.gift-addons-price');
const giftTotalPrice = document.querySelector('.gift-total-price');
const giftResultItems = document.querySelector('.gift-result-items');
const giftResultCopy = document.querySelector('.gift-result-copy');
let giftProduct = {name:'Birthday mini hamper', price:650};
function escapeGiftText(value){ return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function updateGiftResult(){
  const teddy = document.querySelector('.gift-customizer .teddy-options input:checked');
  const selectedItems = [];
  if (teddy && teddy.value !== 'No teddy') selectedItems.push({name:teddy.value, image:teddy.closest('.teddy-card').querySelector('img').src});
  if (!selectedItems.length) { giftResultItems.innerHTML = '<span class="gift-result-empty">Choose a teddy or toy to see your gift here.</span>'; giftResultCopy.textContent = 'Your selected toy and total will update instantly.'; return; }
  giftResultItems.innerHTML = selectedItems.map(item => `<span class="gift-result-item"><img src="${item.image}" alt="${escapeGiftText(item.name)}" /><b>${escapeGiftText(item.name)}</b></span>`).join('');
  const note = giftNote.value.trim();
  giftResultCopy.textContent = `${giftProduct.name} · ${selectedItems.length} add-on${selectedItems.length === 1 ? '' : 's'} · ${giftTotalPrice.textContent}${note ? ` · Note: ${note}` : ''}`;
}
function updateGiftPrice(){
  const teddy = document.querySelector('.gift-customizer .teddy-options input:checked');
  const addons = Number(teddy?.dataset.price || 0);
  giftBasePrice.textContent = `Rs. ${giftProduct.price.toLocaleString()}`;
  giftAddonsPrice.textContent = `Rs. ${addons.toLocaleString()}`;
  giftTotalPrice.textContent = `Rs. ${(giftProduct.price + addons).toLocaleString()}`;
  updateGiftResult();
}
document.querySelectorAll('.gift-customize-trigger').forEach(button => button.addEventListener('click', () => {
  giftProduct = {name:button.dataset.product, price:Number(button.dataset.price)};
  giftCustomizerProduct.textContent = `${giftProduct.name} · Rs. ${giftProduct.price}`;
  giftCustomizer.hidden = false;
  updateGiftPrice();
  giftCustomizer.scrollIntoView({behavior:'smooth', block:'center'});
  showToast(`Customize your ${giftProduct.name}`);
}));
document.querySelector('.gift-customizer-close').addEventListener('click', () => { giftCustomizer.hidden = true; });
document.querySelectorAll('.gift-customizer .teddy-options input').forEach(input => input.addEventListener('change', updateGiftPrice));
giftNote.addEventListener('input', updateGiftResult);
document.querySelector('.gift-customizer-submit').addEventListener('click', () => {
  const teddyOption = document.querySelector('.gift-customizer .teddy-options input:checked');
  const teddy = teddyOption.value;
  const note = giftNote.value.trim();
  const details = [`Toy: ${teddy}`];
  if (note) details.push(`Note: ${note}`);
  const addons = Number(teddyOption.dataset.price || 0);
  addToBag(`${giftProduct.name} · customized`, giftProduct.price + addons, details.join(' · '));
  document.querySelector('.gift-customizer-message').textContent = 'Your customized gift is in the bag ✦';
  showToast('Customized gift added to your bag');
});
let customPhotoDataUrl = '';
photoInput.addEventListener('change', () => { const file = photoInput.files[0]; if (!file) { customPhotoDataUrl = ''; return; } const reader = new FileReader(); reader.onload = () => { customPhotoDataUrl = reader.result; }; reader.readAsDataURL(file); });
document.querySelector('.customize-submit').addEventListener('click', () => { if (customPhotoDataUrl && cart.length) { cart[cart.length - 1].customImage = customPhotoDataUrl; renderBag(); } });
checkoutForm.addEventListener('submit', () => { setTimeout(() => { const savedOrders = JSON.parse(localStorage.getItem('shree-devi-orders') || '[]'); if (savedOrders.length && transactionCode.value.trim()) { savedOrders[savedOrders.length - 1].transactionCode = transactionCode.value.trim(); localStorage.setItem('shree-devi-orders', JSON.stringify(savedOrders)); } }, 0); });
checkoutForm.addEventListener('submit', () => { setTimeout(() => { const savedOrders = JSON.parse(localStorage.getItem('shree-devi-orders') || '[]'); if (savedOrders.length && paymentProofDataUrl) { savedOrders[savedOrders.length - 1].paymentProof = paymentProofDataUrl; localStorage.setItem('shree-devi-orders', JSON.stringify(savedOrders)); } }, 0); });
checkoutForm.addEventListener('submit', () => { setTimeout(async () => { const savedOrders = JSON.parse(localStorage.getItem('shree-devi-orders') || '[]'); const latestOrder = savedOrders[savedOrders.length - 1]; if (!latestOrder) return; const cloudOrder = JSON.parse(JSON.stringify(latestOrder)); delete cloudOrder.paymentProof; cloudOrder.items = (cloudOrder.items || []).map(item => { const clean = {...item}; delete clean.customImage; return clean; }); try { await fetch('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(latestOrder)}); } catch { /* localStorage remains as offline fallback */ } try { const firebase = await window.shreeFirebaseReady; await firebase.setDoc(firebase.doc(firebase.db, 'orders', latestOrder.orderNumber), cloudOrder, {merge:true}); } catch (error) { console.warn('Firebase order sync unavailable; local order is still saved.', error); } }, 350); });
updateLivePreview();
