document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------
    // Upload Functionality
    // -----------------------------------------
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (uploadArea && fileInput) {
        // Handle click to open file dialog
        uploadArea.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });

        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            }, false);
        });

        // Handle file drop
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        // Handle file select
        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });
    }

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        // Validate file
        if (!validateFile(file)) return;
        
        // Process upload
        uploadFile(file);
    }

    function validateFile(file) {
        hideError();
        
        // Check extension
        const validExtensions = ['.pdf', '.docx'];
        const fileName = file.name.toLowerCase();
        const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isValidExt) {
            showError('Chỉ hỗ trợ file định dạng PDF hoặc DOCX.');
            return false;
        }
        
        // Check size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            showError(`Kích thước file quá lớn. Tối đa 10MB. (File của bạn: ${formatFileSize(file.size)})`);
            return false;
        }
        
        return true;
    }

    function uploadFile(file) {
        showLoading('Đang tải lên và phân tích...');
        
        const formData = new FormData();
        formData.append('cv', file);

        // Mock upload for frontend demonstration since API might not exist yet
        setTimeout(() => {
            // Generate a random ID and redirect
            const mockId = Math.random().toString(36).substring(2, 10);
            window.location.href = `/Results?id=${mockId}&filename=${encodeURIComponent(file.name)}`;
        }, 1500);

        /* Real fetch implementation (commented out for now to ensure flow works without backend logic)
        fetch('/api/cv/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            window.location.href = `/Results?id=${data.id}`;
        })
        .catch(error => {
            hideLoading();
            showError('Có lỗi xảy ra khi tải lên. Vui lòng thử lại.');
            console.error('Error:', error);
        });
        */
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        }
    }

    function hideError() {
        if (errorMessage) {
            errorMessage.classList.remove('show');
        }
    }

    // -----------------------------------------
    // Results Page Functionality
    // -----------------------------------------
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (resultsContainer) {
        loadResults();
    }

    function loadResults() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const filename = urlParams.get('filename') || 'my_cv.pdf';
        
        if (!id) {
            window.location.href = '/';
            return;
        }

        // Update filename in UI
        const filenameEl = document.getElementById('filenameDisplay');
        if (filenameEl) filenameEl.textContent = filename;

        showLoading('Đang tải kết quả...');

        // Mock fetch results
        setTimeout(() => {
            const mockData = {
                overallScore: 78,
                breakdown: {
                    presentation: 85,
                    content: 70,
                    keywords: 65,
                    experience: 90
                },
                suggestions: [
                    "Bổ sung thêm các từ khóa kỹ năng cứng phù hợp với vị trí ứng tuyển.",
                    "Phần mục tiêu nghề nghiệp (Objective) còn chung chung, cần cá nhân hóa hơn.",
                    "Nên thêm các con số định lượng để làm nổi bật thành tích (ví dụ: 'tăng 20% doanh thu')."
                ]
            };
            
            renderResults(mockData);
            hideLoading();
        }, 1000);
        
        /* Real fetch
        fetch(`/api/cv/result/${id}`)
            .then(res => res.json())
            .then(data => {
                renderResults(data);
                hideLoading();
            })
            .catch(err => {
                console.error(err);
                hideLoading();
                // show error
            });
        */
    }

    function renderResults(data) {
        // Render Overall Score
        const scoreValue = document.getElementById('scoreValue');
        const scoreCircle = document.getElementById('scoreCircle');
        
        if (scoreValue && scoreCircle) {
            animateValue(scoreValue, 0, data.overallScore, 1500);
            
            // Calculate stroke-dashoffset based on 440 dasharray
            const offset = 440 - (440 * data.overallScore) / 100;
            setTimeout(() => {
                scoreCircle.style.strokeDashoffset = offset;
                
                // Color class
                const colorClass = getScoreColorClass(data.overallScore);
                scoreCircle.classList.add(colorClass);
                scoreValue.classList.add(colorClass);
            }, 100);
        }

        // Render Breakdown
        const breakdownBars = {
            'bar-presentation': data.breakdown.presentation,
            'bar-content': data.breakdown.content,
            'bar-keywords': data.breakdown.keywords,
            'bar-experience': data.breakdown.experience
        };

        for (const [id, score] of Object.entries(breakdownBars)) {
            const bar = document.getElementById(id);
            const valSpan = document.getElementById(id + '-val');
            
            if (bar && valSpan) {
                setTimeout(() => {
                    bar.style.width = `${score}%`;
                    bar.classList.add(getScoreColorClass(score).replace('score-', 'bg-')); // use specific css class if needed, or inline
                    bar.style.backgroundColor = getScoreColorCode(score);
                    animateValue(valSpan, 0, score, 1000);
                }, 300);
            }
        }

        // Render Suggestions
        const suggestionsList = document.getElementById('suggestionsList');
        if (suggestionsList) {
            suggestionsList.innerHTML = '';
            data.suggestions.forEach(sugg => {
                const li = document.createElement('div');
                li.className = 'suggestion-item';
                li.innerHTML = `
                    <div class="suggestion-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.14.74.74 1.21 1.5 1.39 2.36"/></svg>
                    </div>
                    <div class="suggestion-text">${sugg}</div>
                `;
                suggestionsList.appendChild(li);
            });
        }
        
        // Setup Download button
        const downloadBtn = document.getElementById('btnDownload');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                alert('Tính năng tải báo cáo đang được phát triển!');
            });
        }
    }

    // -----------------------------------------
    // Helpers
    // -----------------------------------------
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getScoreColorClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 60) return 'score-medium';
        return 'score-low';
    }
    
    function getScoreColorCode(score) {
        if (score >= 80) return '#16A34A'; // success
        if (score >= 60) return '#D97706'; // warning
        return '#DC2626'; // error
    }

    function showLoading(text) {
        if (loadingOverlay) {
            const textEl = loadingOverlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = text;
            loadingOverlay.classList.add('show');
        }
    }

    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
        }
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
