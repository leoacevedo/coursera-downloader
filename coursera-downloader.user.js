// ==UserScript==
// @name        Coursera Downloader
// @author      Leonardo Acevedo (leo.acevedo@gmail.com)
// @namespace   https://leoacevedo.com/userscripts/coursera-downloader
// @description Download Coursera resources(mp4, pdf, ppt, txt, srt...) from a lecture page, and download reading pages. A download button should appear at the top of the page
// @match       https://www.coursera.org/learn/*/exam/*/*
// @match       https://www.coursera.org/learn/*/home/welcome
// @match       https://www.coursera.org/learn/*/home/week/*
// @match       https://www.coursera.org/learn/*/lecture/*/*
// @match       https://www.coursera.org/learn/*/supplement/*/*
// @match       https://www.coursera.org/learn/*/peer/*/reflective-essay-about-a-learning-challenge
// @match       https://www.coursera.org/learn/*/peer/*/reflective-essay-about-a-learning-challenge/give-feedback
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

        // Lessons are groups of lectures
        const lessons = []

        function createDownloadButton() {
            const result = document.createElement("button")
            result.disabled = true
            result.class = "downloadBtn"
            result.style = "color: white; background: orange; font-weight=700"
            return result
        }

        NodeList.prototype.map = function(f) {
            const result = []
            this.forEach((node) => {
                result.push(f(node))
            })
            return result
        }

        String.prototype.contains = function(str) {
            return this.indexOf(str) > -1
        }

        function main() {
            const homePageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/home\/welcome$/
            const weekPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/home\/week\/\d+$/
            const videoPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/lecture\/\w+\/[\w-]+$/
            const readingPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/supplement\/\w+\/[\w-]+$/
            const examPageRegex = /^https:\/\/www.coursera.org\/learn\/[^/]+\/exam\/\w+\/[\w-]+$/
            const url = window.location.href
            if (videoPageRegex.test(url)) {
                videoPage()
            } else if (readingPageRegex.test(url)) {
                readingPage()
            } else if (weekPageRegex.test(url)) {
                weekPage()
            } else if (homePageRegex.test(url)) {
                homePage()
            } else if (examPageRegex.test(url)) {
                skipPage()
            } else {
                skipPage()
            }
        }

        function downloadBlob(blob, fileName) {
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.innerText = "Download"
            link.download = fileName
            link.click()
        }

        function goToNext() {
            const navLinks = document.querySelectorAll(".nav-link.dim.body-1-text")

            if (navLinks && navLinks.length > 1) {
                const next = navLinks[1]
                next.click()
                return true
            } else {
                return false
            }
        }

        function getBreadcrumbs() {
            return document.querySelectorAll(".breadcrumb-title")
        }

        function getGroupName() {
            return getBreadcrumbs()[1].querySelector("span").innerText
        }

        function setupLessons() {
            const lessonDivs = document.querySelectorAll(".rc-CollapsibleLesson")
            const lessonButtons = lessonDivs.map((div) => div.querySelector("button"))
            const lessonLectures = lessonDivs.map((div) => div.querySelector(".item-list ul"))
            const lessonNames = lessonButtons.map((button) => button.innerText)
            
            for (var i = 0, I = lessonDivs.length; i < I; i++) {
                lessons.push({
                    name: lessonNames[i],
                    div: lessonDivs[i]
                })
            }

            // Expand the lessons that are now collapsed
            console.log(lessonButtons)
            console.log(lessonLectures)
            for (var i = 0, I = lessonLectures.length; i < I; i++) {
                if (!lessonLectures[i]) {
                    lessonButtons[i].click()
                }
            }
        }

        function getLectureName() {
            return getBreadcrumbs()[2].innerText
        }

        function getLectureIndex(lectureName, lessonIndex) {
            const lectures = lessons[lessonIndex].div.querySelectorAll(".item-list ul li")

            for (var i = 0, I = lectures.length; i < I; i++) {
                var liText = lectures[i].innerText
                if (liText.contains(lectureName)) {
                    return i;
                }
            }
            throw "Lecture " + lectureName + " not found in lesson " + lessonIndex
        }
        
        function getLessonName(lectureName) {
            for (var i = 0, I = lessons.length; i < I; i++) {
                var lectures = lessons[i].div.querySelector(".item-list")
                if (lectures != null) {
                    lectures = lectures.innerText
                    console.log("Is " + lectureName + " inside of " + lectures)
                    if (lectures.contains(lectureName)) {
                        return lessons[i].name
                    }
                }
            }
            throw "Lecture " + lectureName + " not found among lessons"
        }


        function getLessonIndex(lessonName) {
            for (var i = 0, I = lessons.length; i < I; i++) {
                if (lessons[i].name == lessonName) {
                    return i
                }
            }
            throw "Lesson not found with name " + lessonName
        }

        function formatFileName(str) {
            var replaceChar = ""
            return str
                .replace(/[,/\:*?""<>|]/g, replaceChar) // forbidden characters
                .replace(/^\./, replaceChar) // cannot start with dot (.)
        }

        function formatNumberInFileName(n) {
            const places = 2
            var result = n.toString()
            while (result.length < places) {
                result = "0" + result
            }
            return result
        }

        function formatLectureName(str) {
            return str.replace(/\(\d+:\d*:?\d*\)\s*$/, "").trim()
        }

        function videoPage() {
            // Information about all the downloads from this page
            const downloadResources = []

            downloadButton.innerHTML = "<span>Download all materials</span>"
            downloadButton.onclick = () => { downloadAll() }
         
            function injectButton() {
                var videoName = document.querySelector("h4")
                if (!videoName) {
                    return false
                }

                videoName.insertAdjacentHTML("beforeEnd", "&nbsp;")
                videoName.insertAdjacentElement("beforeEnd", downloadButton)
                return true
            }

            function getDownloadResources() {
                const downloadDropdownContainer = document.querySelector(".rc-DownloadsDropdown.bt3-dropdown")
                
                // Open the dropdown. Unfortunately I don't know how else to get the download information
                const downloadDropdownButton = downloadDropdownContainer.getElementsByTagName("button")[0]
                downloadDropdownButton.click()

                const groupName = getGroupName()
                const lectureName = formatLectureName(getLectureName())
                const lessonName = getLessonName(lectureName)
                const lessonIndex = getLessonIndex(lessonName)
                const lessonNumber = formatNumberInFileName(1 + lessonIndex)
                const lectureNumber = formatNumberInFileName(1 + getLectureIndex(lectureName, lessonIndex))

                setTimeout(() => {
                    const items = downloadDropdownContainer.querySelectorAll("a.menuitem")
                    for(var i = 0, I = items.length; i < I; i++) {
                        const anchor = items[i]
                        const resourceUrl = anchor.href.trim()
                        const fileExtension = guessResourceExtension(resourceUrl)
                        var resourceName = anchor.querySelectorAll("span")[0].innerText

                        // Give the video and the subtitle the same name so video players pick the subtitle automatically
                        if(fileExtension == "mp4" || fileExtension == "vtt") {
                                resourceName = "Video"
                        }

                        // Remove the file extension from file names that already have it
                        if (resourceName.endsWith("." + fileExtension)) {
                            resourceName = resourceName.substr(0, resourceName.length - 1 - fileExtension.length)
                        }
                        const fileName = formatFileName(
                            groupName + " - " + 
                            lessonNumber + " - " + lessonName + " - " + 
                            lectureNumber + " - " + lectureName + " - " + 
                            resourceName + "." + fileExtension
                        )
                        downloadResources.push({ url: resourceUrl, fileName: fileName })
                    }

                    // Close the dropdown
                    downloadDropdownButton.click()

                    var resourceCount = downloadResources.length
                    var canDownload = resourceCount > 0
                    if (canDownload) {
                        downloadButton.disabled = false
                        downloadAll()
                    } else {
                        // Very likely the connection is too slow. Retry until stuff is ready
                        setTimeout(() => { getDownloadResources() }, 10000)
                    }
                }, 0)
            }

            function downloadAll() {
                downloadResourcesFrom(0)
            }

            function downloadResourcesFrom(index) {
                const resource = downloadResources[index]
                const downloadNextResource = () => {
                    if (index + 1 < downloadResources.length) {
                        downloadResourcesFrom(index + 1)
                    } else {
                        goToNext()
                    }
                }

                xmlHttpRequest({
                    method: "GET",
                    url: resource.url,
                    responseType: "blob",
                    overrideMimeType: OCTET_STREAM, // force browser to download stuff rather than opening a tab
                    onerror: downloadNextResource,
                    onload: (result) => {
                        try {
                            const blob = result.response
                            downloadBlob(blob, resource.fileName)
                        } finally {
                            downloadNextResource()
                        }
                    }
                })
            }

            function guessResourceExtension(url) {
                var urlParts = url.split("?")
                var ext = /fileExtension=(\w{1,5})$/g.exec(urlParts[1]) || /\.(\w{1,5})$/g.exec(urlParts[0])
                var result = ext ? ext[1] : ""
                return result
            }

            function doTheJob() {
                // AJAX-based UI takes some time to generate. Wait for it
                if (injectButton()) {
                    setTimeout(() => { getDownloadResources() }, 2000)
                    setupLessons()
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

                const lectureName = formatLectureName(getLectureName())
                const lessonName = getLessonName(lectureName)
                const lessonIndex = getLessonIndex(lessonName)
                const lessonNumber = formatNumberInFileName(1 + lessonIndex)
                const lectureNumber = formatNumberInFileName(1 + getLectureIndex(lectureName, lessonIndex))

                const fileName = formatFileName(
                    getGroupName() + " - " + 
                    lessonNumber + " - " + lessonName + " - " + 
                    lectureNumber + " - " + lectureName + ".html"
                )
                downloadBlob(blob, fileName)
                goToNext()
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
                    setupLessons()
                    downloadText(textContainer)
                } else {
                    setTimeout(doTheJob, 1000)      
                }
            }

            doTheJob()
        }

        function weekPage() {
            function doTheJob() {
                // AJAX-based UI takes some time to generate. Wait for it
                const firstLectureLink = document.querySelector(".rc-NamedItemList li a")
                if (firstLectureLink) {
                    firstLectureLink.target = "_blank"
                    firstLectureLink.click()
                } else {
                    setTimeout(doTheJob, 1000)
                }
            }

            doTheJob()
        }

        function homePage() {
            function injectButton(courseraLogo) {
                courseraLogo.innerHTML = ""
                courseraLogo.insertAdjacentElement("afterBegin", downloadButton)
                downloadButton.innerHTML = "<span>Download All</span>"
                  downloadButton.disabled = false
                downloadButton.onclick = () => { 
                    window.location.href = window.location.href.replace("welcome", "week/1")
                }
            }

            function doTheJob() {
                // AJAX-based UI takes some time to generate. Wait for it
                const courseraLogo = document.querySelector("h1.body")
                if (courseraLogo) {
                    injectButton(courseraLogo)
                } else {
                    setTimeout(doTheJob, 1000)
                }
            }
            setTimeout(doTheJob, 3000)
        }

        function skipPage() {
            function doTheJob() {
                // AJAX-based UI takes some time to generate. Wait for it
                if (!goToNext()) {
                    setTimeout(doTheJob, 1000)
                }
            }
            doTheJob()
        }

        main()
    }

    window.addEventListener("load", startScript)

    var currentURL = window.location.href
    setInterval(() => {
        const newURL = window.location.href
        if (currentURL != newURL) {
            currentURL = newURL
            startScript()
        }
    }, 1000)
})()
