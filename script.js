$(document).ready(function() {
    // API Anahtarı
    const API_KEY = "d54738cb63c4510a39df9f29efb0b5f8";
    const MAX_RECENT_SEARCHES = 5;
    
    // DOM Elementleri
    const $cityInput = $('#city-input');
    const $searchButton = $('#search-button');
    const $locationButton = $('#location-button');
    const $weatherContainer = $('#weather-container');
    const $errorMessage = $('#error-message');
    const $loading = $('#loading');
    const $recentSearchesList = $('#recent-searches-list');
    
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
        
        // Diğer detaylar
        $('#humidity').text(`${data.main.humidity}%`);
        $('#wind').text(`${data.wind.speed} m/s`);
        $('#pressure').text(`${data.main.pressure} hPa`);
        
        // Hava durumu container'ını göster
        $weatherContainer.removeClass('hidden');
    }
    
    // 5 Günlük Tahmin Verilerini Gösterme
    function displayForecastData(data) {
        const $forecast = $('#forecast');
        $forecast.empty();
        
        // Her gün için öğlen(12:00) tahminini al
        const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00'));
        
        // En fazla 5 gün göster
        const maxDays = Math.min(5, dailyForecasts.length);
        
        for (let i = 0; i < maxDays; i++) {
            const forecast = dailyForecasts[i];
            const date = new Date(forecast.dt * 1000);
            const temperature = Math.round(forecast.main.temp);
            const iconCode = forecast.weather[0].icon;
            
            const forecastHtml = `
                <div class="forecast-item">
                    <div class="forecast-date">${formatForecastDate(date)}</div>
                    <img class="forecast-icon" src="https://openweathermap.org/img/wn/${iconCode}.png" alt="Hava Durumu">
                    <div class="forecast-temp">${temperature}°C</div>
                </div>
            `;
            
            $forecast.append(forecastHtml);
        }
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
    
    // Yardımcı Fonksiyonlar
    function formatDate(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    }
    
    function formatForecastDate(date) {
        const options = { weekday: 'short', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
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
});