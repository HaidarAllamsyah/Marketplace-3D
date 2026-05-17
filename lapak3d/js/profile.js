// js/profile.js - Logic for User Profile

$(document).ready(function() {
    // 1. Redirect Guard
    if (!window.checkLoginStatus()) {
        window.location.href = "index.html";
        return;
    }

    const user = window.getUser();

    // 2. loadUserData()
    function loadUserData() {
        $('#profile-name').text(user.username);
        $('#profile-email').text(user.email);
        
        const initial = user.username.charAt(0).toUpperCase();
        $('#profile-avatar').text(initial);
        
        if (user.isCreator) {
            $('#creator-badge').show();
        }
    }

    // 3. loadStats()
    function loadStats() {
        // Total Pesanan
        const orders = JSON.parse(localStorage.getItem('lapak3d_orders')) || [];
        $('#stat-orders').text(orders.length);

        // Total Lelang yang diikuti (dari data lapak3d_bids di mana username user tercantum di history)
        const bidsData = window.getBids();
        let followedAuctionsCount = 0;
        
        for (let productId in bidsData) {
            let history = bidsData[productId].history;
            if (history.some(bid => bid.user === user.username)) {
                followedAuctionsCount++;
            }
        }
        $('#stat-bids').text(followedAuctionsCount);

        // Menghitung total lelang dimenangkan (dari lapak3d_claimed_ yang bernilai true)
        let totalWins = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('lapak3d_claimed_')) {
                totalWins++;
            }
        }
        $('#stat-wins').text(totalWins);
    }

    // 4. renderOrderHistory()
    function renderOrderHistory() {
        const orders = JSON.parse(localStorage.getItem('lapak3d_orders')) || [];
        const $container = $('#order-history');
        $container.empty();

        if (orders.length === 0) {
            $container.html(`
                <div class="text-center py-5 rounded-4 shadow-sm" style="background-color: var(--bg-card); border: 1px dashed var(--border);">
                    <i class="fa-solid fa-box-open text-muted mb-3" style="font-size: 4rem; opacity: 0.3;"></i>
                    <h5 class="fw-bold text-white mb-2">Belum ada riwayat pembelian</h5>
                    <p class="text-muted mb-4">Mulai eksplorasi katalog untuk menemukan aset 3D pertamamu.</p>
                    <a href="index.html#filter" class="btn btn-outline-primary-custom px-4 py-2 rounded-pill fw-bold hover-lift">Eksplorasi Aset</a>
                </div>
            `);
            return;
        }

        // Tampilkan order terbaru di atas
        const sortedOrders = [...orders].reverse();
        
        sortedOrders.forEach(order => {
            const dateObj = new Date(order.date);
            const dateStr = dateObj.toLocaleDateString('id-ID', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const itemsHtml = order.items.map(item => `
                <div class="d-flex align-items-center mb-3">
                    <img src="${item.thumbnail}" onerror="this.src='assets/thumbnails/placeholder.jpg'" alt="${item.name}" class="rounded-3 me-3 border border-secondary border-opacity-50" style="width: 60px; height: 60px; object-fit: cover;">
                    <div class="flex-grow-1">
                        <div class="fw-semibold text-truncate text-white" style="max-width: 250px;">${item.name}</div>
                        <div class="text-muted fs-7">${item.quantity} x ${item.price === 0 ? '<span class="text-success">Gratis</span>' : window.formatRupiah(item.price)}</div>
                    </div>
                </div>
            `).join('');

            const html = `
                <div class="p-4 rounded-4 shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                    <div class="d-flex justify-content-between align-items-center border-bottom border-secondary pb-3 mb-3" style="border-color: rgba(51, 65, 85, 0.5) !important;">
                        <div>
                            <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 fs-7 me-2"><i class="fa-solid fa-check me-1"></i> Selesai</span>
                            <span class="text-muted fs-7"><i class="fa-regular fa-calendar me-1"></i> ${dateStr}</span>
                        </div>
                        <div class="text-muted fs-7 font-monospace">Order ID: #${order.id.replace('ORD-','')}</div>
                    </div>
                    
                    <div class="row align-items-center">
                        <div class="col-md-8 mb-3 mb-md-0">
                            <div class="fw-bold mb-3 text-muted fs-7 text-uppercase">Detail Item Dibeli:</div>
                            ${itemsHtml}
                        </div>
                        <div class="col-md-4 d-flex flex-column justify-content-center text-md-end border-start-md border-secondary ps-md-4 h-100" style="border-color: rgba(51, 65, 85, 0.5) !important;">
                            <div class="text-muted fs-7 mb-1">Total Belanja</div>
                            <div class="fw-bolder text-primary-light fs-3 mb-3">${order.total === 0 ? 'Gratis' : window.formatRupiah(order.total)}</div>
                            <button class="btn btn-sm btn-outline-success rounded-pill hover-lift shadow-sm w-100 py-2 fw-bold"><i class="fa-solid fa-cloud-arrow-down me-2"></i> Unduh ${order.items.length} Aset</button>
                        </div>
                    </div>
                </div>
            `;
            $container.append(html);
        });
    }

    // 5. renderCreatorStatus()
    function renderCreatorStatus() {
        const $container = $('#creator-content');
        $container.empty();

        if (user.isCreator) {
            $container.html(`
                <div class="p-4 rounded-4 text-center border-primary bg-primary bg-opacity-10 mb-4 shadow-sm" style="border: 1px solid var(--primary);">
                    <i class="fa-solid fa-circle-check text-success fs-1 mb-2"></i>
                    <h4 class="fw-bold text-white mb-1">Verified Creator</h4>
                    <p class="text-primary-light mb-0">Akun Anda telah disetujui sebagai kreator Lapak 3D. Teruslah berkarya!</p>
                </div>
                
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="p-4 rounded-4 text-center shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                            <div class="text-muted fs-7 mb-1 fw-semibold">Aset Diupload</div>
                            <h2 class="fw-bolder text-white mb-0">12</h2>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="p-4 rounded-4 text-center shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                            <div class="text-muted fs-7 mb-1 fw-semibold">Total Penjualan</div>
                            <h2 class="fw-bolder text-white mb-0">845</h2>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="p-4 rounded-4 text-center shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                            <div class="text-muted fs-7 mb-1 fw-semibold">Saldo Pendapatan</div>
                            <h2 class="fw-bolder text-success mb-0">Rp 4.5M</h2>
                        </div>
                    </div>
                </div>

                <div class="text-center mt-5">
                    <a href="upload-asset.html" class="btn btn-primary-custom px-5 py-3 rounded-pill fw-bold fs-5 hover-lift shadow"><i class="fa-solid fa-cloud-arrow-up me-2"></i> Upload Aset Baru</a>
                </div>
            `);
        } else {
            $container.html(`
                <div class="row align-items-center p-4 p-md-5 rounded-4 shadow-sm" style="background-color: var(--bg-card); border: 1px solid var(--border);">
                    <div class="col-md-7 mb-4 mb-md-0">
                        <h3 class="fw-bolder mb-3 text-white"><i class="fa-solid fa-rocket text-primary-light me-2"></i> Mulai Karir Kreator 3D-mu!</h3>
                        <p class="text-muted mb-4 fs-6">Bergabunglah dengan ratusan kreator lainnya dan mulai jual aset 3D buatanmu ke developer di seluruh dunia. Dapatkan benefit eksklusif:</p>
                        
                        <div class="row g-3 mb-4">
                            <div class="col-sm-6">
                                <div class="d-flex align-items-center">
                                    <i class="fa-solid fa-percent text-success me-3 fs-4"></i>
                                    <div><strong class="text-white">Bagi Hasil 85%</strong><br><small class="text-muted">Keuntungan besar</small></div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="d-flex align-items-center">
                                    <i class="fa-solid fa-gavel text-warning me-3 fs-4"></i>
                                    <div><strong class="text-white">Fitur Lelang</strong><br><small class="text-muted">Jual aset eksklusif</small></div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="d-flex align-items-center">
                                    <i class="fa-solid fa-chart-pie text-primary-light me-3 fs-4"></i>
                                    <div><strong class="text-white">Analitik Lengkap</strong><br><small class="text-muted">Pantau penjualan</small></div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="d-flex align-items-center">
                                    <i class="fa-solid fa-users text-info me-3 fs-4"></i>
                                    <div><strong class="text-white">Komunitas Solid</strong><br><small class="text-muted">Dukungan penuh</small></div>
                                </div>
                            </div>
                        </div>

                        <a href="register-creator.html" class="btn btn-primary-custom px-4 py-3 rounded-pill fw-bold hover-lift shadow w-100 w-md-auto text-center">Daftar Jadi Kreator Sekarang</a>
                    </div>
                    <div class="col-md-5 d-none d-md-flex justify-content-center">
                        <i class="fa-solid fa-store text-muted" style="font-size: 12rem; opacity: 0.15; transform: rotate(-5deg);"></i>
                    </div>
                </div>
            `);
        }
    }

    // 6. Tab style tweak (memastikan border active tab berubah warna)
    $('button[data-bs-toggle="pill"]').on('shown.bs.tab', function (e) {
        // Reset all
        $('button[data-bs-toggle="pill"]').css({
            'border-color': 'var(--border)',
            'color': 'var(--text-muted)'
        });
        // Set active
        $(e.target).css({
            'border-color': 'var(--primary)',
            'color': 'white'
        });
    });

    // 7. Event Handlers Buttons
    $('#btn-logout').on('click', function() {
        window.logoutSimulation();
    });

    $('#btn-edit-profile').on('click', function() {
        window.showToast("Fitur edit profil akan segera hadir di versi Lapak 3D selanjutnya!");
    });

    // 8. Execute on ready
    loadUserData();
    loadStats();
    renderOrderHistory();
    renderCreatorStatus();
});
