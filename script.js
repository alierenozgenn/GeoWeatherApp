$(document).ready(function() {
    // API Anahtarı
    const API_KEY = "6c614be9b155ab4c53859c2d7bf8ed34";
    const MAX_RECENT_SEARCHES = 5;
    let temperatureChart = null; // Global chart objesi
    
    // DOM Elementleri
    const $cityInput = $('#city-input');
    const $searchButton = $('#search-button');
    const $locationButton = $('#location-button');
    const $weatherContainer = $('#weather-container');
    const $errorMessage = $('#error-message');
    const $loading = $('#loading');
    const $recentSearchesList = $('#recent-searches-list');
    
    // Mevcut yılı ayarla
    $('#current-year').text(new Date().getFullYear());
    
    // Son aramaları lokalden yükleme
    let recentSearches = loadRecentSearches();
    displayRecentSearches();
    
    // Event Listeners
    $searchButton.on('click', function() {
        const city = $cityInput.val().trim();
        if (city) {
            getWeatherData(city);
        } else {
            showError('Lütfen bir şehir adı girin.');
        }
    });
    
    $cityInput.on('keypress', function(e) {
        if (e.which === 13) { // Enter tuşu
            $searchButton.click();
        }
    });
    
    $locationButton.on('click', function() {
        if (navigator.geolocation) {
            showLoading();
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    getWeatherByCoordinates(lat, lon);
                },
                function(error) {
                    hideLoading();
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            showError('Konum izni reddedildi. Lütfen izin verin veya manuel olarak bir şehir arayın.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            showError('Konum bilgisi alınamadı. Lütfen manuel olarak bir şehir arayın.');
                            break;
                        case error.TIMEOUT:
                            showError('Konum bilgisi alma isteği zaman aşımına uğradı. Lütfen manuel olarak bir şehir arayın.');
                            break;
                        default:
                            showError('Konum alınırken bir hata oluştu. Lütfen manuel olarak bir şehir arayın.');
                            break;
                    }
                }
            );
        } else {
            showError('Tarayıcınız konum hizmetlerini desteklemiyor. Lütfen manuel olarak bir şehir arayın.');
        }
    });
    
    // Son aramalardan bir şehri seçme
    $(document).on('click', '.recent-search-item', function() {
        const city = $(this).text();
        $cityInput.val(city);
        getWeatherData(city);
    });
    
    // Hava Durumu Verilerini API'den Alma
    function getWeatherData(city) {
        city = city.trim().charAt(0).toUpperCase() + city.trim().slice(1).toLowerCase();

        showLoading();
        hideError();
        
        $.ajax({
            url: `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric&lang=tr`,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                // Başarılı durumda hava durumunu göster
                displayWeatherData(data);
                
                // 5 günlük tahmin verilerini al
                getForecastData(data.coord.lat, data.coord.lon);
                
                // Son aramalara ekle
                addToRecentSearches(city);
                
                // Dinamik arka plan ayarla
                setWeatherBackground(data.weather[0].main);
            },
            error: function(jqXHR) {
                hideLoading();
                if (jqXHR.status === 404) {
                    showError(`"${city}" adında bir şehir bulunamadı. Lütfen doğru yazdığınızdan emin olun.`);
                } else {
                    showError('Hava durumu verileri alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
                }
            }
        });
    }
    
    // Koordinatlara Göre Hava Durumu Verilerini Alma
    function getWeatherByCoordinates(lat, lon) {
        $.ajax({
            url: `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                // Başarılı durumda hava durumunu göster
                displayWeatherData(data);
                
                // 5 günlük tahmin verilerini al
                getForecastData(lat, lon);
                
                // Arama kutusuna şehir adını yaz
                $cityInput.val(data.name);
                
                // Son aramalara ekle
                addToRecentSearches(data.name);
                
                // Dinamik arka plan ayarla
                setWeatherBackground(data.weather[0].main);
            },
            error: function() {
                hideLoading();
                showError('Hava durumu verileri alınırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            }
        });
    }
    
    // 5 Günlük Tahmin Verilerini Alma
    function getForecastData(lat, lon) {
        $.ajax({
            url: `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                displayForecastData(data);
                createTemperatureChart(data);
                hideLoading();
            },
            error: function() {
                hideLoading();
                console.error('Tahmin verileri alınamadı.');
            }
        });
    }
    
    // Hava Durumu Verilerini Gösterme
    function displayWeatherData(data) {
        // Şehir ve ülke
        $('#city-name').text(`${data.name}, ${data.sys.country}`);
        
        // Tarih
        const date = new Date();
        $('#date').text(formatDate(date));
        
        // Sıcaklık
        $('#temperature').text(`${Math.round(data.main.temp)}°C`);
        $('#feels-like').text(`Hissedilen: ${Math.round(data.main.feels_like)}°C`);
        
        // Hava durumu açıklaması ve ikon
        $('#description').text(data.weather[0].description);
        const iconCode = data.weather[0].icon;
        $('#weather-icon').attr('src', `https://openweathermap.org/img/wn/${iconCode}@2x.png`);
        $('#weather-icon').attr('alt', data.weather[0].description);
        
        // Diğer detaylar
        $('#humidity').text(`${data.main.humidity}%`);
        $('#wind').text(`${data.wind.speed} m/s`);
        $('#pressure').text(`${data.main.pressure} hPa`);
        
        // Ek bilgiler
        // Gün doğumu ve batımı
        const sunriseTime = new Date(data.sys.sunrise * 1000);
        const sunsetTime = new Date(data.sys.sunset * 1000);
        const now = new Date();

        // Gece mi gündüz mü kontrolü
        if (now < sunriseTime || now > sunsetTime) {
            $('body').addClass('night-theme');
        } else {
            $('body').removeClass('night-theme');
        }

        $('#sunrise').text(formatTime(sunriseTime));
        $('#sunset').text(formatTime(sunsetTime));
        
        // Görüş mesafesi ve bulutluluk
        const visibilityKm = data.visibility / 1000;
        $('#visibility').text(`${visibilityKm.toFixed(1)} km`);
        $('#clouds').text(`${data.clouds.all}%`);
        
        // Hava durumu container'ını göster
        $weatherContainer.addClass('fadeIn').removeClass('hidden');
        updateAdviceMessage(data.weather[0].main);
    }

    function updateAdviceMessage(weatherMain) {
        const $advice = $('#advice-message');
        let message = '';
        const hour = new Date().getHours();
    
        // Saat bazlı selamlama
        let greeting = '';
        if (hour >= 5 && hour < 12) greeting = 'Günaydın!';
        else if (hour >= 12 && hour < 18) greeting = 'İyi günler!';
        else greeting = 'İyi akşamlar!';
    
        // Hava durumuna göre mesaj
        switch(weatherMain.toLowerCase()) {
            case 'rain':
            case 'drizzle':
                message = 'Bugün yağmurlu, dışarı çıkarken dikkatli ol!';
                break;
            case 'clear':
                message = 'Güneşli bir gün, dışarı çıkmak için harika!';
                break;
            case 'snow':
                message = 'Karlı hava var, dışarı çıkarken dikkatli ol!';
                break;
            case 'clouds':
                message = 'Bulutlu bir hava, biraz serin olabilir.';
                break;
            case 'thunderstorm':
                message = 'Gök gürültülü fırtına var, mümkünse dışarı çıkma.';
                break;
            case 'mist':
                message = 'Sisli hava var, görüş mesafesi düşük olabilir.';
                break;
            default:
                message = 'Hava durumu verilerine göre dışarı çıkmadan hazırlıklı ol!';
        }
    
        $advice.text(`${greeting} ${message}`);
        $advice.removeClass('hidden').addClass('fadeIn');
    }
    
    
    // 5 Günlük Tahmin Verilerini Gösterme
    function displayForecastData(data) {
        const $forecast = $('#forecast');
        $forecast.empty();
        
        // Her gün için öğlen(12:00) tahminini al
        const dailyForecasts = getDailyForecasts(data.list);
        
        // En fazla 5 gün göster
        const maxDays = Math.min(5, dailyForecasts.length);
        
        for (let i = 0; i < maxDays; i++) {
            const forecast = dailyForecasts[i];
            const date = new Date(forecast.dt * 1000);
            const temperature = Math.round(forecast.main.temp);
            const iconCode = forecast.weather[0].icon;
            const description = forecast.weather[0].description;
            
            const forecastHtml = `
                <div class="forecast-item">
                    <div class="forecast-date">${formatForecastDate(date)}</div>
                    <img class="forecast-icon" src="https://openweathermap.org/img/wn/${iconCode}.png" alt="${description}">
                    <div class="forecast-temp">${temperature}°C</div>
                    <div class="forecast-description">${description}</div>
                </div>
            `;
            
            $forecast.append(forecastHtml);
        }
    }
    
    // Her günün öğle (12:00) tahminini almak için fonksiyon
    function getDailyForecasts(forecastList) {
        const dailyData = {};
        
        // Her tahmin için mevcut gün kontrolü
        forecastList.forEach(forecast => {
            const date = new Date(forecast.dt * 1000);
            const day = date.toDateString();
            
            // Eğer bugün için henüz bir tahmin kaydetmediyse veya öğlene yakın bir tahminse
            if (!dailyData[day] || Math.abs(date.getHours() - 12) < Math.abs(new Date(dailyData[day].dt * 1000).getHours() - 12)) {
                dailyData[day] = forecast;
            }
        });
        
        // Object'i array'e çevir
        return Object.values(dailyData);
    }
    
    // Sıcaklık Grafiği Oluşturma
    function createTemperatureChart(data) {
        const ctx = document.getElementById('temperatureChart').getContext('2d');
        
        // Önce mevcut grafik varsa yok et
        if (temperatureChart) {
            temperatureChart.destroy();
        }
        
        // Sonraki 24 saat için veri hazırla
        const next24Hours = data.list.slice(0, 8); // 3 saatlik aralıklar (8 x 3 = 24 saat)
        
        const labels = next24Hours.map(item => {
            const time = new Date(item.dt * 1000);
            return formatTime(time);
        });
        
        const temperatures = next24Hours.map(item => Math.round(item.main.temp));
        
        // Chart.js grafiği oluştur
        temperatureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '24 Saatlik Sıcaklık (°C)',
                    data: temperatures,
                    backgroundColor: 'rgba(110, 142, 251, 0.2)',
                    borderColor: 'rgba(110, 142, 251, 1)',
                    borderWidth: 3,
                    tension: 0.3,
                    pointBackgroundColor: 'white',
                    pointBorderColor: 'rgba(110, 142, 251, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#555',
                            font: {
                                family: 'Poppins',
                                size: 14
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '°C';
                            },
                            color: '#666',
                            font: {
                                family: 'Poppins',
                                size: 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: '#666',
                            font: {
                                family: 'Poppins',
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Son Aramaları Lokal Depolamaya Kaydetme
    function addToRecentSearches(city) {
        // Şehri aramada kullanıcı büyük/küçük harf kullanmış olabilir
        // Standart format (ilk harf büyük)
        city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        
        // Zaten listede varsa çıkar (en başa eklemek için)
        recentSearches = recentSearches.filter(item => item !== city);
        
        // Başa ekle
        recentSearches.unshift(city);
        
        // Maksimum eleman sayısını kontrol et
        if (recentSearches.length > MAX_RECENT_SEARCHES) {
            recentSearches.pop();
        }
        
        // LocalStorage'a kaydet
        localStorage.setItem('weatherAppRecentSearches', JSON.stringify(recentSearches));
        
        // Ekranda göster
        displayRecentSearches();
    }
    
    // Lokal Depolamadan Son Aramaları Yükleme
    function loadRecentSearches() {
        const searches = localStorage.getItem('weatherAppRecentSearches');
        return searches ? JSON.parse(searches) : [];
    }
    
    // Son Aramaları Ekranda Gösterme
    function displayRecentSearches() {
        $recentSearchesList.empty();
        
        recentSearches.forEach(city => {
            const $listItem = $('<li>').addClass('recent-search-item').text(city);
            $recentSearchesList.append($listItem);
        });
        
        // Son aramalar varsa göster, yoksa gizle
        if (recentSearches.length > 0) {
            $('.recent-searches').show();
        } else {
            $('.recent-searches').hide();
        }
    }
    
    // Hava Durumuna Göre Arka Plan Ayarlama
    function setWeatherBackground(weatherMain) {
        // Önce tüm hava durumu class'larını temizle
        $('body').removeClass('clear clouds rain snow mist thunderstorm');
        
        // Ardından mevcut hava durumuna göre class ekle
        $('body').addClass(weatherMain.toLowerCase());
        
// Önce mevcut animasyonları yumuşak şekilde kaldır
$('.sun, .cloud, .rain, .snow').removeClass('fade-in').addClass('fade-out');

setTimeout(() => {
    // Tamamen sıfırla
    $('.sun, .cloud, .rain, .snow').removeClass('fade-out visible');

    // Hava durumuna göre yeniden göster
    switch(weatherMain.toLowerCase()) {
        case 'clear':
            $('.sun').addClass('visible fade-in');
            break;
        case 'clouds':
            $('.cloud').addClass('visible fade-in');
            break;
        case 'rain':
        case 'drizzle':
            $('.rain').addClass('visible fade-in');
            createRaindrops();
            break;
        case 'snow':
            $('.snow').addClass('visible fade-in');
            createSnowflakes();
            break;
        case 'thunderstorm':
            $('.rain').addClass('visible fade-in');
            createRaindrops();
            startLightningEffect();
            break;
    }
}, 500); // geçiş süresi kadar beklet

        
        // Hava durumuna göre efektleri göster
        switch(weatherMain.toLowerCase()) {
            case 'clear':
                $('.sun').addClass('visible');
                break;
            case 'clouds':
                $('.cloud').addClass('visible');
                break;
            case 'rain':
            case 'drizzle':
                $('.rain').addClass('visible');
                createRaindrops();
                break;
            case 'snow':
                $('.snow').addClass('visible');
                createSnowflakes();
                break;
            case 'thunderstorm':
                 $('.rain').addClass('visible');
                createRaindrops();
                startLightningEffect(); // şimşek başlasın
                break;
                
        }
        setVideoBackground(weatherMain);
}

    function setVideoBackground(condition) {
        const video = document.getElementById('weather-video');
        let videoName = '';
    
        switch(condition.toLowerCase()) {
            case 'clear': videoName = 'clear.mp4'; break;
            case 'clouds': videoName = 'clouds.mp4'; break;
            case 'rain':
            case 'drizzle': videoName = 'rain.mp4'; break;
            case 'snow': videoName = 'snow.mp4'; break;
            case 'thunderstorm': videoName = 'thunder.mp4'; break;
            case 'mist': videoName = 'mist.mp4'; break;
            default: videoName = 'default.mp4'; break;
        }
    
        if (videoName) {
            video.src = `videos/${videoName}`;
            video.load();
        } else {
            video.removeAttribute('src');
            video.load();
        }
    }
    
    
    // Yağmur Damlası Efekti Oluşturma
    function createRaindrops() {
        const $rain = $('.rain');
        $rain.empty();
        
        const raindropsCount = 100;
        
        for (let i = 0; i < raindropsCount; i++) {
            const $raindrop = $('<div>').addClass('raindrop');
            
            // Rastgele pozisyon ve boyut
            const posX = Math.random() * 100; // %
            const height = 20 + Math.random() * 30; // px
            const duration = 0.7 + Math.random() * 0.9; // saniye
            const delay = Math.random() * 5; // saniye
            
            $raindrop.css({
                left: `${posX}%`,
                height: `${height}px`,
                opacity: 0.5 + Math.random() * 0.5,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`
            });
            
            $rain.append($raindrop);
        }
    }
    
    
    // Kar Tanesi Efekti Oluşturma
    function createSnowflakes() {
        const $snow = $('.snow');
        $snow.empty();
        
        const snowflakesCount = 80;
        
        for (let i = 0; i < snowflakesCount; i++) {
            const $snowflake = $('<div>').addClass('snowflake');
            
            // Rastgele pozisyon, boyut ve animasyon süresi
            const posX = Math.random() * 100; // %
            const size = 3 + Math.random() * 7; // px
            const duration = 6 + Math.random() * 6; // saniye
            const delay = Math.random() * 5; // saniye
            
            $snowflake.css({
                left: `${posX}%`,
                width: `${size}px`,
                height: `${size}px`,
                opacity: 0.6 + Math.random() * 0.4,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`
            });
            
            $snow.append($snowflake);
        }
    }
    
    // Yardımcı Fonksiyonlar
    function formatDate(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    }
    
    function formatForecastDate(date) {
        const options = { weekday: 'short', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    }
    
    function formatTime(date) {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    
    function showLoading() {
        $loading.removeClass('hidden');
    }
    
    function hideLoading() {
        $loading.addClass('hidden');
    }
    
    function showError(message) {
        $errorMessage.find('p').text(message);
        $errorMessage.removeClass('hidden');
    }
    
    function hideError() {
        $errorMessage.addClass('hidden');
    }
    
let lightningInterval;

function startLightningEffect() {
    clearInterval(lightningInterval); // varsa eskiyi temizle

    lightningInterval = setInterval(() => {
        const flash = $('#lightning');
        flash.css('opacity', 0.9);
        $('body').addClass('shake');

        setTimeout(() => {
            flash.css('opacity', 0);
            $('body').removeClass('shake');
        }, 200); // flaş süresi

    }, 3000 + Math.random() * 4000); // her 3-7 saniyede bir şimşek
}

    // Sayfa yüklendiğinde, varsayılan bir şehir için hava durumu göster (isteğe bağlı)
    // Varsayılan olarak 'Samsun' gösteriyoruz
    setTimeout(function() {
        $cityInput.val('Samsun');
        $searchButton.click();
    }, 500);
});

video.onerror = function () {
    console.warn('Video yüklenemedi, arka plan videosu devre dışı.');
    video.style.display = "none"; // görünmez yap
};
