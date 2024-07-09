!function(){"use strict";var e={EvaluationStart:1,EvaluationEnd:2,InitCalled:3,MarkCalled:4,MeasureCalled:5,AddDataCalled:6,SendCalled:7,ForceSampleCalled:8,DataCollectionStart:9,UnloadHandlerTriggered:10,OnloadHandlerTriggered:11,MarkLoadTimeCalled:12,SendCancelledPageHidden:13,SessionIsSampled:21,SessionIsNotSampled:22,MainBeaconSent:23,UserTimingBeaconSent:24,InteractionBeaconSent:25,CustomDataBeaconSent:26,NavigationStart:41,PerformanceEntryReceived:42,PerformanceEntryProcessed:43,PerformanceObserverError:51,InputEventPermissionError:52,InnerHtmlAccessError:53,EventTargetAccessError:54,CookieReadError:55,CookieSetError:56,PageLabelEvaluationError:57,NavTimingNotSupported:71,PaintTimingNotSupported:72,PostBeaconInitialised:80,PostBeaconSendCalled:81,PostBeaconTimeoutReached:82,PostBeaconSent:83,PostBeaconAlreadySent:84,PostBeaconCancelled:85,PostBeaconStopRecording:86,PostBeaconMetricRejected:87,PostBeaconDisabled:88,PostBeaconSendFailed:89,PostBeaconCSPViolation:90};"function"==typeof SuppressedError&&SuppressedError;var n={as:"activationStart",rs:"redirectStart",re:"redirectEnd",fs:"fetchStart",ds:"domainLookupStart",de:"domainLookupEnd",cs:"connectStart",sc:"secureConnectionStart",ce:"connectEnd",qs:"requestStart",bs:"responseStart",be:"responseEnd",oi:"domInteractive",os:"domContentLoadedEventStart",oe:"domContentLoadedEventEnd",oc:"domComplete",ls:"loadEventStart",le:"loadEventEnd",sr:"startRender",fc:"firstContentfulPaint",lc:"largestContentfulPaint"};function t(e,t){if(t)return function(e,n){var t=e.match(new RegExp("".concat(n,"(\\d+)")));return t?parseFloat(t[1]):null}(a(e,"NT"),t);var r=a(e,"NT").match(/[a-z]+[0-9]+/g);return r?Object.fromEntries(r.map((function(e){var t=e.match(/[a-z]+/)[0];return[n[t],parseFloat(e.match(/\d+/)[0])]}))):{}}function a(e,n){return e.searchParams.get(n)||""}function r(e){return e.map((function(e){return JSON.stringify(e)})).join(", ")}var o=document.querySelector("#input"),c=document.querySelector("#event-counter"),i=document.querySelector("#output"),s=document.querySelector("#parse"),d=document.querySelectorAll(".event-filter");if(!o||!i||!s)throw new Error("Cannot start debug parser.");function l(n){n.innerHTML="";var a=[];try{a=JSON.parse(o.value)}catch(e){n.appendChild(u("Could not parse input: ".concat(e),"red"))}c.innerText="(".concat(a.length," events)");for(var i=Number(new Date(a[0][0])),s=0,l=a;s<l.length;s++){var m=l[s];if(m[1]===e.NavigationStart){i=m[2][0];break}}var p=i,S=!1,v=function(e){var n=[];return e.forEach((function(e){var t=e.getAttribute("data-event");e.checked&&t&&n.push(t)})),n}(d);a.forEach((function(o,c){var s=Number(new Date(o[0]))-i,d=function(n,t){var a=Object.keys(e).find((function(t){return e[t]===n[1]})),o=n[2],c=a||"Unknown Event";switch(o.length&&(c+=" (".concat(r(o),")")),n[1]){case 0:return"The lux.js script was not loaded on this page.";case e.EvaluationStart:return"lux.js v".concat(o[0]," is initialising.");case e.EvaluationEnd:return"lux.js has finished initialising.";case e.InitCalled:return"LUX.init()";case e.MarkLoadTimeCalled:return"LUX.markLoadTime(".concat(r(o),")");case e.MarkCalled:return t.includes("userTiming")?"LUX.mark(".concat(r(o),")"):"";case e.MeasureCalled:return t.includes("userTiming")?"LUX.measure(".concat(r(o),")"):"";case e.AddDataCalled:return t.includes("addData")?"LUX.addData(".concat(r(o),")"):"";case e.SendCalled:return"LUX.send()";case e.SendCancelledPageHidden:return"This beacon was not sent because the page visibility was hidden.";case e.ForceSampleCalled:return"LUX.forceSample()";case e.DataCollectionStart:return"Preparing to send main beacon. Metrics received after this point may be ignored.";case e.UnloadHandlerTriggered:return"Unload handler was triggered.";case e.OnloadHandlerTriggered:return c="Onload handler was triggered after ".concat(o[0]," ms."),o[1]>0&&(c+=" Minimum measure time was ".concat(o[1])),c;case e.SessionIsSampled:return"Sample rate is ".concat(o[0],"%. This session is being sampled.");case e.SessionIsNotSampled:return"Sample rate is ".concat(o[0],"%. This session is not being sampled.");case e.MainBeaconSent:return c="Main beacon sent",t.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.UserTimingBeaconSent:return c="Supplementary user timing beacon sent",t.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.InteractionBeaconSent:return c="Supplementary user interaction beacon sent",t.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.CustomDataBeaconSent:return c="Supplementary custom data beacon sent",t.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.PostBeaconInitialised:return"POST beacon initialised.";case e.PostBeaconSendCalled:return"POST beacon send() called.";case e.PostBeaconTimeoutReached:return"POST beacon maximum measure timeout reached.";case e.PostBeaconSent:return t.includes("beaconUrl")?"POST beacon sent: ".concat(o[0]):"POST beacon sent.";case e.PostBeaconSendFailed:return t.includes("beaconUrl")?"POST beacon send failed: ".concat(o[0]):"POST beacon send failed.";case e.PostBeaconAlreadySent:return"POST beacon cancelled (already sent).";case e.PostBeaconCancelled:return"POST beacon cancelled.";case e.PostBeaconStopRecording:return"POST beacon is no longer recording metrics. Metrics received after this point may be ignored.";case e.PostBeaconMetricRejected:return"POST beacon metric rejected: ".concat(o[0]);case e.PostBeaconCSPViolation:return"POST beacon cancelled due to CSP violation.";case e.NavigationStart:return"";case e.PerformanceEntryReceived:return"layout-shift"===o[0].entryType?"Received layout shift at ".concat(o[0].startTime.toFixed()," ms with value of ").concat(o[0].value.toFixed(3)):"longtask"===o[0].entryType?"Received long task with duration of ".concat(o[0].duration," ms"):"event"===o[0].entryType?0===o[0].interactionId?"Ignored INP entry with no interaction ID":"Received INP entry with duration of ".concat(o[0].duration," ms (ID: ").concat(o[0].interactionId,")"):"first-input"===o[0].entryType?"Received FID entry with duration of ".concat(o[0].duration," ms"):"largest-contentful-paint"===o[0].entryType?"Received LCP entry at ".concat(o[0].startTime.toFixed()," ms"):"element"===o[0].entryType?"Received element timing entry for ".concat(o[0].identifier," at ").concat(o[0].startTime.toFixed()," ms"):(c="Received ".concat(o[0].entryType," entry"),o[0].startTime&&(c+=" at ".concat(o[0].startTime.toFixed()," ms")),c);case e.PerformanceEntryProcessed:return"largest-contentful-paint"===o[0].entryType?"Picked LCP from entry at ".concat(o[0].startTime.toFixed()," ms"):"";case e.PerformanceObserverError:return"Error while initialising PerformanceObserver: ".concat(o[0]);case e.InputEventPermissionError:return"Error reading input event. Cannot calculate FID for this page.";case e.InnerHtmlAccessError:return"Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";case e.EventTargetAccessError:return"Error reading input event. Cannot calculate user interaction times for this page.";case e.CookieReadError:return"Error reading session cookie. This page will not be linked to a user session.";case e.CookieSetError:return"Error setting session cookie. This page will not be linked to a user session.";case e.PageLabelEvaluationError:return"Error while evaluating '".concat(o[0],"' for the page label: ").concat(o[1]);case e.NavTimingNotSupported:return"The Navigation Timing API is not supported. Performance metrics for this page will be limited.";case e.PaintTimingNotSupported:return"Start render time could not be determined."}return c}(o,v),l=o[2];if(d){if(function(n){return[e.MainBeaconSent,e.CustomDataBeaconSent,e.InteractionBeaconSent,e.UserTimingBeaconSent].includes(n)}(o[1])){(b=u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(d))).classList.add("tooltip-container");var m=new URL(l[0]),g=t(m);(P=document.createElement("div")).className="tooltip",P.innerHTML='\n          <div class="tooltip-inner">\n            <b>Page label:</b> '.concat(m.searchParams.get("l"),"<br>\n            <b>Hostname:</b> ").concat(m.searchParams.get("HN"),"<br>\n            <b>Path:</b> ").concat(m.searchParams.get("PN"),"<br>\n            <b>lux.js version:</b> ").concat(m.searchParams.get("v"),"<br>\n            <hr>\n            <b>LCP:</b> ").concat(g.largestContentfulPaint,"<br>\n            <b>CLS:</b> ").concat(m.searchParams.get("DCLS"),"<br>\n            <b>INP:</b> ").concat(m.searchParams.get("INP"),"<br>\n            <b>FID:</b> ").concat(m.searchParams.get("FID"),"<br>\n          </div>\n        "),b.appendChild(P),n.appendChild(b)}else if(o[1]===e.EvaluationStart){(b=u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(d," Hover to view configuration."))).classList.add("tooltip-container");var f=l[1];try{f=JSON.parse(f)}catch(e){}(P=document.createElement("div")).className="tooltip",P.innerHTML='\n          <div class="tooltip-inner">\n            <pre>'.concat(JSON.stringify(f,null,4),"</pre>\n          </div>\n        "),b.appendChild(P),n.appendChild(b)}else if(o[1]===e.PostBeaconSent){var b;(b=u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(d," Hover to view data."))).classList.add("tooltip-container");var P,h=l[1];try{h=JSON.parse(h)}catch(e){}(P=document.createElement("div")).className="tooltip",P.innerHTML='\n          <div class="tooltip-inner">\n            <pre>'.concat(JSON.stringify(h,null,4),"</pre>\n          </div>\n        "),b.appendChild(P),n.appendChild(b)}else n.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(d)));if(o[1]===e.DataCollectionStart&&(S=!0),o[1]===e.InitCalled&&(p=o[0],S=!1),o[1]===e.SendCalled)o[0]-p<1e3&&n.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ⚠️ Data was gathered for less than 1 second. Consider increasing the value of LUX.minMeasureTime.")));if(S&&o[1]===e.PerformanceEntryReceived)a[c+1][1]!==e.PerformanceEntryReceived&&n.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ⚠️ Performance entries were received after the beacon was sent.")))}}));var g=new Date(i);n.prepend(u("0 ms: Navigation started at ".concat(g.toLocaleDateString()," ").concat(g.toLocaleTimeString())))}function u(e,n){var t=document.createElement("li");return t.textContent=e,t.className=n||"",t}s.addEventListener("click",(function(){return l(i)})),d.forEach((function(e){e.addEventListener("change",(function(){return l(i)}))})),o.value&&l(i)}();
