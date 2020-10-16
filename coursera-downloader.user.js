// ==UserScript==
// @name        Coursera Downloader
// @author      Leonardo Acevedo (leo.acevedo@gmail.com)
// @namespace   https://leoacevedo.com/userscripts/coursera-downloader
// @description Download Coursera resources(mp4, pdf, ppt, txt, srt...) from a lecture page, and download reading pages. A download button should appear at the top of the page
// @match       https://www.coursera.org/learn/*/lecture/*/*
// @match       https://www.coursera.org/learn/*/supplement/*/*
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// @version     1.0
// ==/UserScript==

(function() {
    function startScript() {
        // Work both with GreaseMonkey and TamperMonkey
        const xmlHttpRequest = window.GM_xmlhttpRequest || GM.xmlHttpRequest
        const OCTET_STREAM = "application/octet-stream"
        const downloadButton = createDownloadButton()

        function createDownloadButton() {
            const result = document.createElement("button")
            result.disabled = true
            result.class = "downloadBtn"
            result.style = "color: white; background: orange; font-weight=700"
            return result
        }

        
        function main() {
            const videoPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/lecture\/\w+\/[\w-]+$/
            const readingPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/supplement\/\w+\/[\w-]+$/
            const url = window.location.href
            if (videoPageRegex.test(url)) {
                videoPage()
            } else if (readingPageRegex.test(url)) {
                readingPage()
            }
        }

        function downloadBlob(blob, fileName) {
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.innerText = 'Download'
            link.download = fileName
            link.click()
        }

        function getBreadcrumbs() {
            return document.querySelectorAll('.breadcrumb-title')
        }

        function getGroupName() {
            return getBreadcrumbs()[1].querySelector("span").innerHTML
        }

        function formatFileName(str) {
            var replaceChar = ''
            return str
                .replace(/[,/\:*?""<>|]/g, replaceChar) // forbidden characters
                .replace(/^\./, replaceChar) // cannot start with dot (.)
        }

        function videoPage() {
            // Information about all the downloads from this page
            const downloadResources = []

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
                        const fileName = formatFileName(getGroupName() + " - " + lessonName + ' - ' + resourceName + "." + fileExtension)
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
                    overrideMimeType: OCTET_STREAM, // force browser to download stuff rather than opening a tab
                    onerror: goToNext,
                    onload: (result) => {
                        try {
                            const blob = result.response
                            downloadBlob(blob, resource.fileName)
                        } finally {
                            goToNext()
                        }
                    }
                })
            }

            function formatLessonName(str) {
                return str.replace(/\(\d+:\d*:?\d*\)\s*$/, "").trim()
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
        }

        function readingPage() {
            const containerSelector = ".rc-CML.styled"

            function downloadText(textContainer) {
                const finalHtml = "<html><body>" + textContainer.innerHTML + "</body></html>"
                const blob = new Blob([finalHtml], { type: OCTET_STREAM })
                const lessonName = getBreadcrumbs()[2].innerText
                const fileName = formatFileName(getGroupName() + " - " + lessonName + ".html")
                downloadBlob(blob, fileName)
            }

            function injectButton(textContainer) {
                textContainer.insertAdjacentElement("beforeBegin", downloadButton)
                downloadButton.innerHTML = "<span>Download reading</span>"
                downloadButton.disabled = false
                downloadButton.onclick = () => { downloadText(textContainer) }
            }

            function doTheJob() {
                // AJAX-based UI takes some time to generate. Wait for it
                const textContainer = document.querySelector(containerSelector) 
                if (textContainer) {
                    injectButton(textContainer)
                } else {
                    setTimeout(doTheJob, 1000)      
                }
            }

            doTheJob()
        }

        main()
    }

    window.addEventListener('load', startScript)

    var currentURL = window.location.href
    setInterval(() => {
        const newURL = window.location.href
        if (currentURL != newURL) {
            currentURL = newURL
            startScript()
        }
    }, 1000)
})()