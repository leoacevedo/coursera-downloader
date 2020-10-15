// ==UserScript==
// @name        Coursera Downloader
// @namespace   https://leoacevedo.com/userscripts/coursera-downloader
// @description Download Coursera resources(mp4, pdf, ppt, txt, srt...) from a lecture page. 'Download all materials' should appear at the top of the page
// @match       https://www.coursera.org/*/lecture/*
// @match       https://www.coursera.org/*/lecture/index
// @match       https://www.coursera.org/*/lecture
// @version     1.0
// ==/UserScript==

window.addEventListener('load', () => {
    const downloadResources = []
    var downloadBtn = null;

    function injectButton() {
        var videoName = document.querySelector('h4')
        if (!videoName) {
            return false;
        }

        const downloadButtonHTML = "&nbsp; \
            <button class='downloadBtn' style='color: white; background: orange; font-weight=700'>\
                <span>Download all materials</span>\
            </button>";
        videoName.insertAdjacentHTML("beforeEnd", downloadButtonHTML);
        downloadBtn = document.getElementsByClassName("downloadBtn")[0]
        downloadBtn.onclick = () => { downloadAll() }
        return true;
    }

    function extractResources() {
        const breadcrumbs = document.querySelectorAll('.breadcrumb-title')
        const groupName = breadcrumbs[1].querySelector("span").innerHTML
        const downloadSection = document.querySelector('.rc-DownloadsDropdown.bt3-dropdown')
        const downloadButton = downloadSection.getElementsByTagName('button')[0]
        downloadButton.click()

        setTimeout(() => {
            const items = downloadSection.querySelectorAll('a.menuitem')
            for(var i = 0, I = items.length; i < I; i++) {
                var anchor = items[i];
                var resourceUrl = anchor.href.trim()
                var fileExtension = guessResourceExtension(resourceUrl)
                var videoName = document.querySelector('h4').childNodes[0].textContent
                var lessonName = formatLessonName(videoName);
                
                var anchorTexts = anchor.querySelectorAll('span');
                var resourceName = anchorTexts[0].innerText;

                if(fileExtension == 'mp4' || fileExtension == 'vtt') {
                        resourceName = "Video"
                }
                if (resourceName.endsWith('.' + fileExtension)) {
                    resourceName = resourceName.substr(0, resourceName.length - 1 - fileExtension.length)
                }
                var fileName = formatFileName(groupName + " - " + lessonName + ' - ' + resourceName + "." + fileExtension);
                anchor.download = fileName;
                downloadResources.push({ url: resourceUrl, fileName: fileName })
                console.log(fileName)
            }
            downloadButton.click()
        }, 2000)
    }

    function downloadAll() {
        downloadResourcesFrom(0)
    }

    function downloadResourcesFrom(index) {
        const resource = downloadResources[index];
        fetch(resource.url)
            .then((result) => {
                return result.arrayBuffer()
            })
            .then((buffer) => {
                const blob = new Blob([buffer], { type: 'application/octet-stream' })
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.innerText = 'Open the array URL';
                link.download = resource.fileName
                link.click()
            })
            .then((ignore) => {
                // Next resource
                if (index + 1 < downloadResources.length) {
                    downloadResourcesFrom(index + 1)
                }
            })
    }

    function formatLessonName(str) {
        return str.replace(/\(\d+:\d*:?\d*\)\s*$/, "").trim();
    }

    function formatFileName(str) {
        var replaceChar = '';
        return str
            .replace(/[,/\:*?""<>|]/g, replaceChar) // forbidden characters
            .replace(/^\./, replaceChar); // cannot start with dot (.)
    }

    function guessResourceExtension(url) {
        var urlParts = url.split('?');
        var ext = /fileExtension=(\w{1,5})$/g.exec(urlParts[1]) || /\.(\w{1,5})$/g.exec(urlParts[0]);
        var result = ext ? ext[1] : "";
        return result;
    }

    function doTheJob() {
        if (injectButton()) {
            extractResources()
        } else {
            setTimeout(arguments.callee, 2000);            
        }
    }

    doTheJob()
})
