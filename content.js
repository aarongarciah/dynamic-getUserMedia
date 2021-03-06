var inject = '('+function() {
    /* behaviour is controlled via sessionStorage. Remember it stores JSON...
    sessionStorage.__getUserMediaAudioError = "NotAllowedError";
    sessionStorage.__getUserMediaVideoError = "NotFoundError";
    sessionStorage.__filterAudioDevices = true;
    sessionStorage.__filterVideoDevices = true;
    sessionStorage.__filterDeviceLabels = true;
    */

    // override getUserMedia to inject errors.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(constraints) {
        var err;

        // for consistency with the device modifications reject with a NotFoundError.
        if (constraints.audio && sessionStorage.__filterAudioDevices) {
            err = new Error('getUserMedia error');
            err.name = 'NotFoundError';
            return Promise.reject(err);
        }

        var isScreenSharing = constraints.video && (constraints.video.mediaSource || constraints.video.mandatory && constraints.video.mandatory.chromeMediaSource);
        if (constraints.video && sessionStorage.__filterVideoDevices && !isScreenSharing) {
            err = new Error('getUserMedia error');
            err.name = 'NotFoundError';
            return Promise.reject(err);
        }

        // return errors
        if (constraints.audio && sessionStorage.__getUserMediaAudioError) {
            err = new Error('getUserMedia error');
            err.name = sessionStorage.__getUserMediaAudioError;
            return Promise.reject(err);
        }
        if (constraints.video && sessionStorage.__getUserMediaVideoError) {
            err = new Error('getUserMedia error');
            err.name = sessionStorage.__getUserMediaVideoError;
            return Promise.reject(err);
        }

        if (constraints.video && constraints.video.deviceId &&
                (constraints.video.deviceId.exact ? constraints.video.deviceId.exact.indexOf('dynamicGum:fake:') === 0 : constraints.video.deviceId.indexOf('dynamicGum:fake:') === 0)) {
            var canvas = document.createElement('canvas');
            canvas.width = 640; // TODO: actual width/height.
            canvas.height = 480;
            var ctx = canvas.getContext('2d', {alpha: false});
            ctx.fillStyle = (constraints.video.deviceId.exact ? constraints.video.deviceId.exact : constraints.video.deviceId).substr(16);
            ctx.fillRect(0,0,canvas.width, canvas.height);
            var videoStream = canvas.captureStream();
            var videoTrack = videoStream.getVideoTracks()[0];
            delete constraints.video;
            return origGetUserMedia(constraints)
            .then(stream => {
                stream.addTrack(videoTrack);
                return stream;
            });
        }
        return origGetUserMedia(constraints);
    };

    // override enumerateDevices to filter certain device kinds or return empty labels
    // (which means no permission has been granted). Also returns empty labels
    // when getUserMedia permission is denied via a session storage flag.
    var origEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function() {
        return origEnumerateDevices()
            .then((devices) => {
                if (sessionStorage.__filterVideoDevices) {
                    devices = devices.filter((device) => device.kind !== 'videoinput');
                }
                if (sessionStorage.__filterAudioDevices) {
                    devices = devices.filter((device) => device.kind !== 'audioinput');
                }
                if (sessionStorage.__filterDeviceLabels
                    || sessionStorage.__getUserMediaAudioError === 'NotAllowedError'
                    || sessionStorage.__getUserMediaVideoError === 'NotAllowedError') {
                    devices = devices.map((device) => {
                        var deviceWithoutLabel = {
                            deviceId: device.deviceId,
                            kind: device.kind,
                            label: '',
                            groupId: device.groupId,
                        };
                        return deviceWithoutLabel;
                    });
                }
                if (sessionStorage.__fakeVideoDevices) {
                    JSON.parse(sessionStorage.__fakeVideoDevices).forEach(function(fakeDeviceSpec) {
                        devices.push({
                            deviceId: 'dynamicGum:fake:' + fakeDeviceSpec.color,
                            kind: 'videoinput',
                            label: fakeDeviceSpec.label,
                            groupId: 'fake devices',
                        });
                    });
                }
                return devices;
            });
    };
}+')();';

document.addEventListener('DOMContentLoaded', function() {
    var script = document.createElement('script');
    script.textContent = inject;
    var parent = document.head || document.documentElement;
    parent.insertBefore(script, parent.firstChild);
    script.parentNode.removeChild(script);
});
