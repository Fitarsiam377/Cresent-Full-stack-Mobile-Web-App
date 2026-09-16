// ============================================
// DELIVERY SYSTEM - LEAFLET + NOMINATIM + HAVERSINE
// Recipient box with auto-filled data
// ============================================

let deliveryMap = null;
let deliveryMarkerPickup = null;
let deliveryMarkerDropoff = null;
let deliveryRouteLayer = null;
let deliveryDistance = 0;
let deliveryTravelCost = 0;
let routeUpdateTimeout = null;

// =============================================
// OPEN DELIVERY MODAL
// =============================================
function openDeliveryModal(requestId, donorId, donorName, donorPhone, donorAddress, bloodGroup) {
    const modal = document.getElementById('deliveryModal');
    const content = document.getElementById('deliveryModalContent');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please login first.');
        return;
    }
    
    firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
            const userData = doc.data() || {};
            const userName = userData.name || 'User';
            const userPhone = userData.phone || '';
            const userBloodGroup = userData.bloodGroup || 'N/A';
            const userAddress = userData.location 
                ? `${userData.location.city}, ${userData.location.area}` 
                : '';
            
            content.innerHTML = `
                <div class="delivery-modal-header">
                    <h2>🚚 Blood Delivery Request</h2>
                    <button class="modal-close-btn" onclick="closeDeliveryModal()">&times;</button>
                </div>
                <div class="delivery-modal-body">
                    
                    <!-- ===== DONOR + RECIPIENT INFO ===== -->
                    <div class="delivery-info-grid">
                        
                        <!-- DONOR (Read-only) -->
                        <div class="delivery-info-card">
                            <h4>🩸 Donor</h4>
                            <p><strong>Name:</strong> ${donorName}</p>
                            <p><strong>Phone:</strong> ${donorPhone}</p>
                            <p><strong>Address:</strong> <span id="donorAddressDisplay">${donorAddress || 'Enter below'}</span></p>
                            <p><strong>Blood Group:</strong> ${bloodGroup}</p>
                        </div>
                        
                        <!-- RECIPIENT (Editable Name/Phone, Auto Address/Blood) -->
                        <div class="delivery-info-card" style="background:#eef7ff; border:1.5px solid #3498db;">
                            <h4>👤 Recipient</h4>
                            
                            <div class="form-group" style="margin-bottom:6px;">
                                <label style="font-size:11px; color:#555; font-weight:600; display:block; margin-bottom:2px;">Name</label>
                                <input 
                                    type="text" 
                                    id="recipientName" 
                                    value="${userName}" 
                                    placeholder="Recipient name"
                                    style="
                                        width:100%; padding:5px 8px;
                                        border:1px solid #b8d8f0; border-radius:5px;
                                        font-size:12px; box-sizing:border-box;
                                        background:white; color:#2c3e50;
                                    "
                                />
                            </div>
                            
                            <div class="form-group" style="margin-bottom:6px;">
                                <label style="font-size:11px; color:#555; font-weight:600; display:block; margin-bottom:2px;">Phone</label>
                                <input 
                                    type="tel" 
                                    id="recipientPhone" 
                                    value="${userPhone}" 
                                    placeholder="01XXXXXXXXX"
                                    style="
                                        width:100%; padding:5px 8px;
                                        border:1px solid #b8d8f0; border-radius:5px;
                                        font-size:12px; box-sizing:border-box;
                                        background:white; color:#2c3e50;
                                    "
                                />
                            </div>
                            
                            <p style="margin:4px 0; font-size:12px;">
                                <strong>Address:</strong> 
                                <span id="recipientAddressDisplay" style="color:#3498db;">${userAddress || 'Set via map below'}</span>
                            </p>
                            <p style="margin:4px 0; font-size:12px;">
                                <strong>Blood Group:</strong> 
                                <span style="color:#c0392b; font-weight:700;">${userBloodGroup}</span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- ===== LOCATION & DISTANCE ===== -->
                    <div class="delivery-location-section">
                        <h4>📍 Location & Distance</h4>
                        <div class="delivery-location-inputs">
                            <div class="form-group">
                                <label>Donor Location (Pickup)</label>
                                <input type="text" id="deliveryPickup" placeholder="Search address..." 
                                    oninput="autoCalculateRoute()" onchange="autoCalculateRoute()" />
                            </div>
                            <div class="form-group">
                                <label>Recipient Location (Dropoff)</label>
                                <input type="text" id="deliveryDropoff" placeholder="Search address..." 
                                    oninput="autoCalculateRoute()" onchange="autoCalculateRoute()" />
                            </div>
                        </div>
                        <div class="delivery-distance-info">
                            <span>📏 Distance: <strong id="deliveryDistanceDisplay">0 km</strong></span>
                            <span>💰 Travel Cost: <strong id="deliveryCostDisplay">0 BDT</strong></span>
                        </div>
                        <div id="deliveryMap" style="height:250px; width:100%; margin-top:10px; border-radius:12px; background:#e8e4e0;"></div>
                    </div>
                    
                    <!-- ===== PAYMENT ===== -->
                    <div class="delivery-payment-section">
                        <h4>💳 Payment Method</h4>
                        <div class="payment-options">
                            <label class="payment-option">
                                <input type="radio" name="paymentMethod" value="bkash" checked />
                                <span class="payment-label">bKash</span>
                            </label>
                            <label class="payment-option">
                                <input type="radio" name="paymentMethod" value="nagad" />
                                <span class="payment-label">Nagad</span>
                            </label>
                            <label class="payment-option">
                                <input type="radio" name="paymentMethod" value="cash" />
                                <span class="payment-label">Cash</span>
                            </label>
                        </div>
                        <div id="paymentNumberField" class="form-group" style="display:none;">
                            <label>Payment Number</label>
                            <input type="text" id="paymentNumber" placeholder="Enter bKash/Nagad number" />
                        </div>
                    </div>
                    
                    <!-- ===== ACTIONS ===== -->
                    <div class="delivery-actions">
                        <button class="btn-primary" onclick="submitDeliveryRequest('${requestId}', '${donorId}')">
                            <i class="fas fa-paper-plane"></i> Request Delivery
                        </button>
                        <button class="btn-secondary" onclick="closeDeliveryModal()">Cancel</button>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            setTimeout(() => {
                initDeliveryMap(donorAddress, userAddress);
            }, 100);
            
            // Payment method toggle
            document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    document.getElementById('paymentNumberField').style.display = 
                        (this.value === 'bkash' || this.value === 'nagad') ? 'block' : 'none';
                });
            });
            
            // Autocomplete setup
            setupAutocomplete('deliveryPickup', 'donorAddressDisplay');
            setupAutocomplete('deliveryDropoff', 'recipientAddressDisplay');
        })
        .catch(err => {
            console.error('Error:', err);
            alert('Could not load user data.');
        });
}

// =============================================
// CLOSE DELIVERY MODAL
// =============================================
function closeDeliveryModal() {
    document.getElementById('deliveryModal').style.display = 'none';
    if (deliveryMap) {
        deliveryMap.remove();
        deliveryMap = null;
    }
    if (routeUpdateTimeout) {
        clearTimeout(routeUpdateTimeout);
        routeUpdateTimeout = null;
    }
}

// =============================================
// INIT LEAFLET MAP
// =============================================
function initDeliveryMap(donorAddress, userAddress) {
    if (typeof L === 'undefined') {
        document.getElementById('deliveryMap').innerHTML = '<p style="padding:20px;text-align:center;color:#999;">Leaflet library not loaded.</p>';
        return;
    }
    
    const mapElement = document.getElementById('deliveryMap');
    const defaultLat = 23.8103;
    const defaultLng = 90.4125;
    
    deliveryMap = L.map(mapElement, { zoomControl: false }).setView([defaultLat, defaultLng], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(deliveryMap);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(deliveryMap);
    
    if (donorAddress) {
        document.getElementById('deliveryPickup').value = donorAddress;
        document.getElementById('donorAddressDisplay').textContent = donorAddress;
    }
    if (userAddress) {
        document.getElementById('deliveryDropoff').value = userAddress;
        document.getElementById('recipientAddressDisplay').textContent = userAddress;
    }
    
    setTimeout(() => {
        if (document.getElementById('deliveryPickup').value.trim() && document.getElementById('deliveryDropoff').value.trim()) {
            manualCalculateRoute();
        }
    }, 500);
}

// =============================================
// AUTOCOMPLETE - Nominatim
// =============================================
function setupAutocomplete(inputId, displayId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let timeout = null;
    
    input.addEventListener('input', function() {
        clearTimeout(timeout);
        const query = this.value.trim();
        if (query.length < 3) return;
        
        timeout = setTimeout(() => {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=bd`;
            fetch(url, {
                headers: { 'User-Agent': 'CrescentPlusApp/1.0' }
            })
            .then(res => {
                if (!res.ok) throw new Error('Nominatim error');
                return res.json();
            })
            .then(data => {
                const datalist = document.getElementById(`${inputId}List`) || (() => {
                    const dl = document.createElement('datalist');
                    dl.id = `${inputId}List`;
                    document.body.appendChild(dl);
                    return dl;
                })();
                datalist.innerHTML = '';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.display_name;
                    datalist.appendChild(option);
                });
                input.setAttribute('list', `${inputId}List`);
            })
            .catch(err => console.warn('Nominatim autocomplete error:', err));
        }, 500);
    });
    
    // Update recipient address display when dropoff changes
    if (inputId === 'deliveryDropoff') {
        input.addEventListener('change', function() {
            const display = document.getElementById(displayId);
            if (display && this.value.trim()) {
                display.textContent = this.value.trim();
            }
        });
    }
}

// =============================================
// AUTO CALCULATE (debounced)
// =============================================
function autoCalculateRoute() {
    clearTimeout(routeUpdateTimeout);
    routeUpdateTimeout = setTimeout(manualCalculateRoute, 600);
}

// =============================================
// MANUAL CALCULATE
// =============================================
function manualCalculateRoute() {
    const pickup = document.getElementById('deliveryPickup').value.trim();
    const dropoff = document.getElementById('deliveryDropoff').value.trim();
    
    const distDisplay = document.getElementById('deliveryDistanceDisplay');
    const costDisplay = document.getElementById('deliveryCostDisplay');
    
    // Update recipient address display
    const recipientDisplay = document.getElementById('recipientAddressDisplay');
    if (recipientDisplay && dropoff) {
        recipientDisplay.textContent = dropoff;
    }
    
    if (!pickup || !dropoff) {
        distDisplay.textContent = '0 km';
        costDisplay.textContent = '0 BDT';
        deliveryDistance = 0;
        deliveryTravelCost = 0;
        clearMapLayers();
        return;
    }
    
    if (pickup.toLowerCase() === dropoff.toLowerCase()) {
        distDisplay.textContent = '0 km';
        costDisplay.textContent = '0 BDT';
        deliveryDistance = 0;
        deliveryTravelCost = 0;
        clearMapLayers();
        return;
    }
    
    Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup)}&limit=1`, {
            headers: { 'User-Agent': 'CrescentPlusApp/1.0' }
        }).then(r => r.json()),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dropoff)}&limit=1`, {
            headers: { 'User-Agent': 'CrescentPlusApp/1.0' }
        }).then(r => r.json())
    ])
    .then(([pickupData, dropoffData]) => {
        if (!pickupData.length || !dropoffData.length) {
            throw new Error('Address not found');
        }
        const pLat = parseFloat(pickupData[0].lat);
        const pLon = parseFloat(pickupData[0].lon);
        const dLat = parseFloat(dropoffData[0].lat);
        const dLon = parseFloat(dropoffData[0].lon);
        
        const distanceKm = haversineDistance(pLat, pLon, dLat, dLon);
        const totalCost = Math.round(distanceKm * 20);
        
        distDisplay.textContent = `${distanceKm} km`;
        costDisplay.textContent = `${totalCost} BDT`;
        deliveryDistance = distanceKm;
        deliveryTravelCost = totalCost;
        
        drawStraightLine(pLat, pLon, dLat, dLon);
    })
    .catch(err => {
        console.error('❌ Calculation failed:', err);
        distDisplay.textContent = '0 km';
        costDisplay.textContent = '0 BDT';
        deliveryDistance = 0;
        deliveryTravelCost = 0;
        clearMapLayers();
    });
}

// =============================================
// HAVERSINE DISTANCE
// =============================================
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 10) / 10;
}

// =============================================
// DRAW STRAIGHT LINE
// =============================================
function drawStraightLine(lat1, lon1, lat2, lon2) {
    if (!deliveryMap) return;
    clearMapLayers();
    const coords = [[lat1, lon1], [lat2, lon2]];
    deliveryRouteLayer = L.polyline(coords, { color: '#c0392b', weight: 4, dashArray: '5, 5' }).addTo(deliveryMap);
    deliveryMap.fitBounds(deliveryRouteLayer.getBounds(), { padding: [30, 30] });
    deliveryMarkerPickup = L.marker([lat1, lon1], { title: 'Pickup' }).addTo(deliveryMap);
    deliveryMarkerDropoff = L.marker([lat2, lon2], { title: 'Dropoff' }).addTo(deliveryMap);
}

// =============================================
// CLEAR MAP LAYERS
// =============================================
function clearMapLayers() {
    if (!deliveryMap) return;
    if (deliveryRouteLayer) {
        deliveryMap.removeLayer(deliveryRouteLayer);
        deliveryRouteLayer = null;
    }
    if (deliveryMarkerPickup) {
        deliveryMap.removeLayer(deliveryMarkerPickup);
        deliveryMarkerPickup = null;
    }
    if (deliveryMarkerDropoff) {
        deliveryMap.removeLayer(deliveryMarkerDropoff);
        deliveryMarkerDropoff = null;
    }
}

// =============================================
// SUBMIT DELIVERY REQUEST
// =============================================
function submitDeliveryRequest(requestId, donorId) {
    const user = firebase.auth().currentUser;
    if (!user) { alert('Please login.'); return; }
    
    const recipientName = document.getElementById('recipientName').value.trim();
    const recipientPhone = document.getElementById('recipientPhone').value.trim();
    const recipientAddress = document.getElementById('deliveryDropoff').value.trim();
    const recipientBloodGroup = document.getElementById('recipientAddressDisplay')?.dataset?.blood || 'N/A';
    
    if (!recipientName) { alert('Please enter recipient name.'); return; }
    if (!recipientPhone) { alert('Please enter recipient phone.'); return; }
    
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentMethod) { alert('Select payment method.'); return; }
    
    let paymentNumber = '';
    if (paymentMethod.value === 'bkash' || paymentMethod.value === 'nagad') {
        paymentNumber = document.getElementById('paymentNumber').value.trim();
        if (!paymentNumber) { alert('Enter payment number.'); return; }
    }
    
    const pickup = document.getElementById('deliveryPickup').value.trim();
    const dropoff = document.getElementById('deliveryDropoff').value.trim();
    if (!pickup || !dropoff) { alert('Enter both addresses.'); return; }
    
    if (deliveryDistance === 0) {
        alert('Please wait for distance calculation or enter different addresses.');
        return;
    }
    
    firebase.firestore().collection('users').doc(user.uid).get()
        .then((userDoc) => {
            const userData = userDoc.data() || {};
            const userBloodGroup = userData.bloodGroup || 'N/A';
            
            return firebase.firestore().collection('users').doc(donorId).get()
                .then((donorDoc) => {
                    const donorData = donorDoc.data() || {};
                    return firebase.firestore().collection('deliveryRequests').add({
                        requestId: requestId,
                        donorId: donorId,
                        
                        // Donor info
                        donorName: donorData.name || 'Unknown',
                        donorPhone: donorData.phone || 'N/A',
                        donorAddress: pickup,
                        donorProfilePic: donorData.profilePic || null,
                        donorBloodGroup: donorData.bloodGroup || 'N/A',
                        
                        // Recipient info (from editable form)
                        userId: user.uid,
                        userName: recipientName,
                        userPhone: recipientPhone,
                        userAddress: dropoff,
                        userProfilePic: userData.profilePic || null,
                        bloodGroup: userBloodGroup,
                        
                        // Delivery details
                        travelCost: deliveryTravelCost,
                        distance: deliveryDistance,
                        paymentMethod: paymentMethod.value,
                        paymentNumber: paymentNumber || null,
                        status: 'pending',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
        })
        .then(() => {
            alert('✅ Delivery request submitted!');
            closeDeliveryModal();
            if (typeof loadMyRequests === 'function') loadMyRequests();
            if (typeof loadPendingRequests === 'function') loadPendingRequests();
            if (typeof loadMyDeliveryRequests === 'function') loadMyDeliveryRequests();
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        });
}

// =============================================
// PRINT DELIVERY CARD
// =============================================
function printDeliveryCard(deliveryId) {
    firebase.firestore().collection('deliveryRequests').doc(deliveryId).get()
        .then((doc) => {
            if (!doc.exists) { alert('Not found.'); return; }
            const data = doc.data();
            const win = window.open('', '_blank');
            win.document.write(`
                <html><head><title>Blood Delivery Card</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 30px; max-width: 400px; margin: auto; }
                    .card { border: 2px solid #2c3e50; border-radius: 16px; padding: 24px; }
                    .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 12px; }
                    .header h2 { margin: 0; color: #2c3e50; }
                    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
                    .row .label { font-weight: 600; color: #555; }
                    .row .value { color: #2c3e50; }
                    .payment { background: #f8f6f4; padding: 12px; border-radius: 8px; margin: 12px 0; }
                    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
                </style>
                </head><body>
                <div class="card">
                    <div class="header"><h2>🩸 Blood Delivery Card</h2><p style="margin:0;color:#c0392b;">Crescent+</p></div>
                    <div style="margin-top:12px;">
                        <div class="row"><span class="label">Donor</span><span class="value">${data.donorName}</span></div>
                        <div class="row"><span class="label">Phone</span><span class="value">${data.donorPhone}</span></div>
                        <div class="row"><span class="label">Address</span><span class="value">${data.donorAddress}</span></div>
                        <div class="row"><span class="label">Blood</span><span class="value">${data.donorBloodGroup || data.bloodGroup || 'N/A'}</span></div>
                        <div style="height:8px;"></div>
                        <div class="row"><span class="label">Recipient</span><span class="value">${data.userName}</span></div>
                        <div class="row"><span class="label">Phone</span><span class="value">${data.userPhone}</span></div>
                        <div class="row"><span class="label">Address</span><span class="value">${data.userAddress}</span></div>
                        <div class="row"><span class="label">Blood</span><span class="value">${data.bloodGroup || 'N/A'}</span></div>
                        <div style="height:8px;"></div>
                        <div class="row"><span class="label">Distance</span><span class="value">${data.distance} km</span></div>
                        <div class="row"><span class="label">Travel Cost</span><span class="value">${data.travelCost} BDT</span></div>
                        <div class="payment"><strong>Payment:</strong> ${data.paymentMethod.toUpperCase()} ${data.paymentNumber ? ' - '+data.paymentNumber : ''}</div>
                        <div class="row"><span class="label">Status</span><span class="value">${data.status}</span></div>
                    </div>
                    <div class="footer">Crescent+ · Blood Donation Platform</div>
                </div>
                <script>window.print();</script>
                </body></html>
            `);
            win.document.close();
        });
}
