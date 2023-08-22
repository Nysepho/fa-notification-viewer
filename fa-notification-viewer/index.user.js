// ==UserScript==
// @name        Fur Affinity Notification Viewer
// @namespace   https://github.com/Nysepho/fa-notification-viewer
// @match       https://www.furaffinity.net/*
// @run-at      document-end
// @inject-into content
// @version     1.0
// @author      Nysepho
// @description Browse your Fur Affinity submission notifications.
// @icon        https://www.furaffinity.net/favicon.ico
// ==/UserScript==

const STORAGE_KEY = 'fa-notification-viewer-script';
const LOG_PREFIX = '[Fur Affinity Notification Viewer]';

if (window.location.pathname.startsWith('/msg/submissions')) {
    addStartViewerButton()
} else if (window.location.pathname.startsWith('/view/')) {
    resumeViewerSession()
}

function addStartViewerButton() {
    let gallerySection = document.querySelector('.gallery-section');
    let buttonsSection = gallerySection.querySelector('div.section-body:nth-child(2) > div:nth-child(1)');

    let startViewerButton = document.createElement('a');
    startViewerButton.classList.add('button', 'standard', 'a');
    startViewerButton.innerText = 'Start Viewer 🚀';
    startViewerButton.addEventListener('click', () => {
        let allSubmissionIds = Array
            .from(gallerySection.getElementsByTagName('figure'))
            .map(f => Number(f.id.replace('sid-', '')))
            .reverse();

        startViewerSession(allSubmissionIds)
    });

    buttonsSection.appendChild(startViewerButton)
}

function startViewerSession(submissionIds) {
    let initSessionData = {
        submissionIds: submissionIds,
        removedIds: []
    };

    storeSessionData(initSessionData);
    navigateToSubmission(submissionIds[0])
}

function resumeViewerSession() {
    let sessionData = retrieveSessionData();
    if (sessionData === null) return;

    let idFromUrl = Number(window.location.pathname.split('/')[2]);
    let submissionIndex = sessionData.submissionIds.indexOf(idFromUrl);
    if (submissionIndex === -1) return;

    let isLastSubmission = submissionIndex === sessionData.submissionIds.length - 1;
    let nextSubmissionId = sessionData.submissionIds[Math.min(submissionIndex + 1, sessionData.submissionIds.length)];
    let previousSubmissionId = sessionData.submissionIds[Math.max(submissionIndex - 1, 0)];

    let favoriteActionUrl = document.querySelector('.submission-sidebar > .buttons > .fav > a').href;
    let isAlreadyFavorite = favoriteActionUrl.includes('/unfav/');

    let notificationAlreadyRemoved = sessionData.removedIds.includes(idFromUrl);

    let sessionControls = `
        <section id="fanvs" style="position: fixed; bottom: 0; right: 0; box-shadow: 0 0 10px 2px rgba(0,0,0,0.75);">
            <div class="section-header">
                <strong>Notification Viewer Script</strong>
            </div>
            
            <div class="section-body" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="submission-description" style="align-self: center;">
                    ${submissionIndex + 1} / ${sessionData.submissionIds.length}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <a id="fanvs-fav" class="button standard a">
                        ${isAlreadyFavorite ? '-' : '+'} Fav${notificationAlreadyRemoved ? '' : ', Remove'}${isLastSubmission ? '' : ' and Continue'}
                    </a>
                    
                    <a id="fanvs-skip" class="button standard a">Remove${isLastSubmission ? '' : ' and Continue'}</a>
                </div>
                
                <div style="display: flex; justify-content: space-between; gap: 5px;">
                    <a id="fanvs-prev" class="button standard a">Prev</a>
                    <a id="fanvs-finish" class="button standard a" style="width: 80%;">Finish</a>
                    <a id="fanvs-next" class="button standard a">Next</a>
                </div>
            </div>
        </section>`;

    let controls = document.createElement('div');
    controls.innerHTML = sessionControls;

    let previousButton = controls.querySelector('#fanvs-prev');
    let nextButton = controls.querySelector('#fanvs-next');
    let finishButton = controls.querySelector('#fanvs-finish');
    let favButton = controls.querySelector('#fanvs-fav');
    let skipButton = controls.querySelector('#fanvs-skip');

    // Configure previous button
    if (submissionIndex > 0) {
        previousButton.addEventListener('click', () => navigateToSubmission(previousSubmissionId))
    } else {
        previousButton.style.opacity = '0.5'
    }

    // Configure next button
    if (submissionIndex < sessionData.submissionIds.length - 1) {
        nextButton.addEventListener('click', () => navigateToSubmission(nextSubmissionId))
    } else {
        nextButton.style.opacity = '0.5'
    }

    // Configure finish button
    finishButton.addEventListener('click', () => {
        clearSessionData();
        document.getElementById('fanvs').remove()
    });

    // Configure favorite/unfavorite button
    favButton.addEventListener('click', () => {
        if (isAlreadyFavorite && !confirm(`${LOG_PREFIX}:\n\nThis submission is already a favorite.\n\nClick OK to unfavorite it.`))
            return;

        fetch(favoriteActionUrl)
            .then(() => {
                removeNotification(idFromUrl)
                    .then(r => {
                        addRemovedSubmissionId(idFromUrl);

                        if (isLastSubmission) {
                            window.location.href = '/msg/submissions/';
                            return
                        }

                        navigateToSubmission(nextSubmissionId);
                    })
            })
            .catch((error) => {
                alert(`${LOG_PREFIX}: unable to update favorite, please check the browser log for more details.`);
                console.error(LOG_PREFIX, error)
            })
    });

    // Configure skip button
    if (notificationAlreadyRemoved) {
        skipButton.style.opacity = '0.5'
    } else {
        skipButton.addEventListener('click', () => {
            removeNotification(idFromUrl)
                .then(() => {
                    addRemovedSubmissionId(idFromUrl);

                    if (isLastSubmission) {
                        window.location.href = '/msg/submissions/';
                        return
                    }

                    navigateToSubmission(nextSubmissionId)
                })
                .catch((error) => {
                    alert(`${LOG_PREFIX}: unable to remove notification, please check the browser log for more details.`);
                    console.error(LOG_PREFIX, error)
                })
        })

    }

    document.body.insertAdjacentElement('beforeend', controls)
}

function navigateToSubmission(id) {
    window.location.href = `/view/${id}`
}

function removeNotification(id) {
    // https://github.com/greasemonkey/greasemonkey/issues/2647
    return fetch(window.location.origin + '/msg/submissions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'submissions[]': id,
            'messagecenter-action': 'remove_checked'
        })
    })
}

function storeSessionData(sessionData) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
}

function retrieveSessionData() {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY))
}

function clearSessionData() {
    sessionStorage.removeItem(STORAGE_KEY)
}

function addRemovedSubmissionId(id) {
    let existingSessionData = retrieveSessionData();
    if (!existingSessionData) return;
    existingSessionData.removedIds.push(id);
    storeSessionData(existingSessionData)
}
