// ==UserScript==
// @name        Coursera Downloader
// @author      Leonardo Acevedo (leo.acevedo@gmail.com)
// @namespace   https://leoacevedo.com/userscripts/coursera-downloader
// @description Download Coursera resources(mp4, pdf, ppt, txt, srt...) from a lecture page. 'Download all materials' should appear at the top of the page
// @match       https://www.coursera.org/*/lecture/*
// @match       https://www.coursera.org/*/lecture/index
// @match       https://www.coursera.org/*/lecture
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// @version     1.0
// ==/UserScript==

window.addEventListener('load', () => {
    // Work both with GreaseMonkey and TamperMonkey
    const xmlHttpRequest = window.GM_xmlhttpRequest || GM.xmlHttpRequest
    
    // Information about all the downloads from this page
    const downloadResources = []

    // Button to trigger all the downloads. It is enabled only when downloadResources contains something
    const downloadButton = document.createElement("button")
    downloadButton.disabled = true
    downloadButton.class = "downloadBtn"
    downloadButton.style = "color: white; background: orange; font-weight=700"
    downloadButton.innerHTML = "<span>Download all materials</span>"
    downloadButton.onclick = () => { downloadAll() }
 
    function injectButton() {
        var videoName = document.querySelector('h4')
        if (!videoName) {
            return false
        }

        videoName.insertAdjacentHTML("beforeEnd", "&nbsp;")
        videoName.insertAdjacentElement("beforeEnd", downloadButton)
        return true
    }

    function getDownloadResources() {
        // Breadcrumbs and the dropdown content have text that helps in giving the downloads proper names
        const breadcrumbs = document.querySelectorAll('.breadcrumb-title')
        const groupName = breadcrumbs[1].querySelector("span").innerHTML
        const downloadDropdownContainer = document.querySelector('.rc-DownloadsDropdown.bt3-dropdown')
        
        // Open the dropdown. Unfortunately I don't know how else to get the download information
        const downloadDropdownButton = downloadDropdownContainer.getElementsByTagName('button')[0]
        downloadDropdownButton.click()

        setTimeout(() => {
            const items = downloadDropdownContainer.querySelectorAll('a.menuitem')
            for(var i = 0, I = items.length; i < I; i++) {
                var anchor = items[i]
                var resourceUrl = anchor.href.trim()
                var fileExtension = guessResourceExtension(resourceUrl)
                var videoName = document.querySelector('h4').childNodes[0].textContent
                var lessonName = formatLessonName(videoName)
                
                var anchorTexts = anchor.querySelectorAll('span')
                var resourceName = anchorTexts[0].innerText

                // Give the video and the subtitle the same name so video players pick the subtitle automatically
                if(fileExtension == 'mp4' || fileExtension == 'vtt') {
                        resourceName = "Video"
                }

                // Remove the file extension from file names that already have it
                if (resourceName.endsWith('.' + fileExtension)) {
                    resourceName = resourceName.substr(0, resourceName.length - 1 - fileExtension.length)
                }
                var fileName = formatFileName(groupName + " - " + lessonName + ' - ' + resourceName + "." + fileExtension)
                downloadResources.push({ url: resourceUrl, fileName: fileName })
            }

            // Close the dropdown
            downloadDropdownButton.click()

            var resourceCount = downloadResources.length
            var canDownload = resourceCount > 0
            if (canDownload) {
                downloadButton.disabled = false

                var shouldDownload = confirm("Download " + resourceCount + " files?")
                if (shouldDownload) {
                    downloadAll()
                }
            } else {
                // Very likely the connection is too slow. Retry until stuff is ready
                setTimeout(() => { getDownloadResources() }, 10_000)
            }
        }, 0)
    }

    function downloadAll() {
        downloadResourcesFrom(0)
    }

    function downloadResourcesFrom(index) {
        const resource = downloadResources[index]
        const goToNext = () => {
            if (index + 1 < downloadResources.length) {
                downloadResourcesFrom(index + 1)
            }
        }

        xmlHttpRequest({
            method: "GET",
            url: resource.url,
            responseType: "blob",
            overrideMimeType: "application/octet-stream", // force browser to download stuff rather than opening a tab
            onerror: goToNext,
            onload: (result) => {
                try {
                    const blob = result.response
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.innerText = 'Open the array URL'
                    link.download = resource.fileName
                    link.click()
                } finally {
                    goToNext()
                }
            }
        })
    }

    function formatLessonName(str) {
        return str.replace(/\(\d+:\d*:?\d*\)\s*$/, "").trim()
    }

    function formatFileName(str) {
        var replaceChar = ''
        return str
            .replace(/[,/\:*?""<>|]/g, replaceChar) // forbidden characters
            .replace(/^\./, replaceChar) // cannot start with dot (.)
    }

    function guessResourceExtension(url) {
        var urlParts = url.split('?')
        var ext = /fileExtension=(\w{1,5})$/g.exec(urlParts[1]) || /\.(\w{1,5})$/g.exec(urlParts[0])
        var result = ext ? ext[1] : ""
        return result
    }

    function doTheJob() {
        // AJAX-based UI takes some time to generate. Wait for it
        if (injectButton()) {
            setTimeout(() => { getDownloadResources() }, 2000)
        } else {
            setTimeout(doTheJob, 1000)
        }
    }

    doTheJob()
})
