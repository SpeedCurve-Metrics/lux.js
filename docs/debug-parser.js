!function(){"use strict";var e={EvaluationStart:1,EvaluationEnd:2,InitCalled:3,MarkCalled:4,MeasureCalled:5,AddDataCalled:6,SendCalled:7,ForceSampleCalled:8,DataCollectionStart:9,UnloadHandlerTriggered:10,OnloadHandlerTriggered:11,MarkLoadTimeCalled:12,SendCancelledPageHidden:13,SessionIsSampled:21,SessionIsNotSampled:22,MainBeaconSent:23,UserTimingBeaconSent:24,InteractionBeaconSent:25,CustomDataBeaconSent:26,NavigationStart:41,PerformanceEntryReceived:42,PerformanceEntryProcessed:43,PerformanceObserverError:51,InputEventPermissionError:52,InnerHtmlAccessError:53,EventTargetAccessError:54,CookieReadError:55,CookieSetError:56,PageLabelEvaluationError:57,NavTimingNotSupported:71,PaintTimingNotSupported:72};"function"==typeof SuppressedError&&SuppressedError;var t={as:"activationStart",rs:"redirectStart",re:"redirectEnd",fs:"fetchStart",ds:"domainLookupStart",de:"domainLookupEnd",cs:"connectStart",sc:"secureConnectionStart",ce:"connectEnd",qs:"requestStart",bs:"responseStart",be:"responseEnd",oi:"domInteractive",os:"domContentLoadedEventStart",oe:"domContentLoadedEventEnd",oc:"domComplete",ls:"loadEventStart",le:"loadEventEnd",sr:"startRender",fc:"firstContentfulPaint",lc:"largestContentfulPaint"};function n(e,n){if(n)return function(e,t){var n=e.match(new RegExp("".concat(t,"(\\d+)")));return n?parseFloat(n[1]):null}(a(e,"NT"),n);var r=a(e,"NT").match(/[a-z]+[0-9]+/g);return r?Object.fromEntries(r.map((function(e){var n=e.match(/[a-z]+/)[0];return[t[n],parseFloat(e.match(/\d+/)[0])]}))):{}}function a(e,t){return e.searchParams.get(t)||""}function r(e){return e.map((function(e){return JSON.stringify(e)})).join(", ")}var o=document.querySelector("#input"),c=document.querySelector("#event-counter"),i=document.querySelector("#output"),s=document.querySelector("#parse"),l=document.querySelectorAll(".event-filter");if(!o||!i||!s)throw new Error("Cannot start debug parser.");function d(t){t.innerHTML="";var a=[];try{a=JSON.parse(o.value)}catch(e){t.appendChild(u("Could not parse input: ".concat(e),"red"))}c.innerText="(".concat(a.length," events)");for(var i=Number(new Date(a[0][0])),s=0,d=a;s<d.length;s++){var m=d[s];if(m[1]===e.NavigationStart){i=m[2][0];break}}var p=i,f=!1,g=function(e){var t=[];return e.forEach((function(e){var n=e.getAttribute("data-event");e.checked&&n&&t.push(n)})),t}(l);a.forEach((function(o,c){var s=Number(new Date(o[0]))-i,l=function(t,n){var a=Object.keys(e).find((function(n){return e[n]===t[1]})),o=t[2],c=a||"Unknown Event";switch(o.length&&(c+=" (".concat(r(o),")")),t[1]){case 0:return"The lux.js script was not loaded on this page.";case e.EvaluationStart:return"lux.js v".concat(o[0]," is initialising.");case e.EvaluationEnd:return"lux.js has finished initialising.";case e.InitCalled:return"LUX.init()";case e.MarkLoadTimeCalled:return"LUX.markLoadTime(".concat(r(o),")");case e.MarkCalled:return n.includes("userTiming")?"LUX.mark(".concat(r(o),")"):"";case e.MeasureCalled:return n.includes("userTiming")?"LUX.measure(".concat(r(o),")"):"";case e.AddDataCalled:return n.includes("addData")?"LUX.addData(".concat(r(o),")"):"";case e.SendCalled:return"LUX.send()";case e.SendCancelledPageHidden:return"This beacon was not sent because the page visibility was hidden.";case e.ForceSampleCalled:return"LUX.forceSample()";case e.DataCollectionStart:return"Preparing to send main beacon. Any metrics received after this point may be ignored.";case e.UnloadHandlerTriggered:return"Unload handler was triggered.";case e.OnloadHandlerTriggered:return c="Onload handler was triggered after ".concat(o[0]," ms."),o[1]>0&&(c+=" Minimum measure time was ".concat(o[1])),c;case e.SessionIsSampled:return"Sample rate is ".concat(o[0],"%. This session is being sampled.");case e.SessionIsNotSampled:return"Sample rate is ".concat(o[0],"%. This session is not being sampled.");case e.MainBeaconSent:return c="Main beacon sent",n.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.UserTimingBeaconSent:return c="Supplementary user timing beacon sent",n.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.InteractionBeaconSent:return c="Supplementary user interaction beacon sent",n.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.CustomDataBeaconSent:return c="Supplementary custom data beacon sent",n.includes("beaconUrl")&&(c+=": ".concat(o[0])),c;case e.NavigationStart:return"";case e.PerformanceEntryReceived:return"layout-shift"===o[0].entryType?"Received layout shift at ".concat(o[0].startTime.toFixed()," ms with value of ").concat(o[0].value.toFixed(3)):"longtask"===o[0].entryType?"Received long task with duration of ".concat(o[0].duration," ms"):"event"===o[0].entryType?"Received INP entry with duration of ".concat(o[0].duration," ms"):"first-input"===o[0].entryType?"Received FID entry with duration of ".concat(o[0].duration," ms"):"largest-contentful-paint"===o[0].entryType?"Received LCP entry at ".concat(o[0].startTime.toFixed()," ms"):"element"===o[0].entryType?"Received element timing entry for ".concat(o[0].identifier," at ").concat(o[0].startTime.toFixed()," ms"):(c="Received ".concat(o[0].entryType," entry"),o[0].startTime&&(c+=" at ".concat(o[0].startTime.toFixed()," ms")),c);case e.PerformanceEntryProcessed:return"largest-contentful-paint"===o[0].entryType?"Picked LCP from entry at ".concat(o[0].startTime.toFixed()," ms"):"";case e.PerformanceObserverError:return"Error while initialising PerformanceObserver: ".concat(o[0]);case e.InputEventPermissionError:return"Error reading input event. Cannot calculate FID for this page.";case e.InnerHtmlAccessError:return"Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";case e.EventTargetAccessError:return"Error reading input event. Cannot calculate user interaction times for this page.";case e.CookieReadError:return"Error reading session cookie. This page will not be linked to a user session.";case e.CookieSetError:return"Error setting session cookie. This page will not be linked to a user session.";case e.PageLabelEvaluationError:return"Error while evaluating '".concat(o[0],"' for the page label: ").concat(o[1]);case e.NavTimingNotSupported:return"The Navigation Timing API is not supported. Performance metrics for this page will be limited.";case e.PaintTimingNotSupported:return"Start render time could not be determined."}return c}(o,g),d=o[2];if(l){if(function(t){return[e.MainBeaconSent,e.CustomDataBeaconSent,e.InteractionBeaconSent,e.UserTimingBeaconSent].includes(t)}(o[1])){(S=u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(l))).classList.add("tooltip-container");var m=new URL(d[0]),v=n(m);(h=document.createElement("span")).className="tooltip",h.innerHTML="\n          <b>Page label:</b> ".concat(m.searchParams.get("l"),"<br>\n          <b>Hostname:</b> ").concat(m.searchParams.get("HN"),"<br>\n          <b>Path:</b> ").concat(m.searchParams.get("PN"),"<br>\n          <b>lux.js version:</b> ").concat(m.searchParams.get("v"),"<br>\n          <hr>\n          <b>LCP:</b> ").concat(v.largestContentfulPaint,"<br>\n          <b>CLS:</b> ").concat(m.searchParams.get("DCLS"),"<br>\n          <b>INP:</b> ").concat(m.searchParams.get("INP"),"<br>\n          <b>FID:</b> ").concat(m.searchParams.get("FID"),"<br>\n        "),S.appendChild(h),t.appendChild(S)}else if(o[1]===e.EvaluationStart){var S;(S=u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(l," Hover to view configuration."))).classList.add("tooltip-container");var h,b=d[1];try{b=JSON.parse(b)}catch(e){}(h=document.createElement("span")).className="tooltip",h.innerHTML="<pre>".concat(JSON.stringify(b,null,4),"</pre>"),S.appendChild(h),t.appendChild(S)}else t.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ").concat(l)));if(o[1]===e.DataCollectionStart&&(f=!0),o[1]===e.InitCalled&&(p=o[0],f=!1),o[1]===e.SendCalled)o[0]-p<1e3&&t.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ⚠️ Data was gathered for less than 1 second. Consider increasing the value of LUX.minMeasureTime.")));if(f&&o[1]===e.PerformanceEntryReceived)a[c+1][1]!==e.PerformanceEntryReceived&&t.appendChild(u("".concat((new Intl.NumberFormat).format(s)," ms: ⚠️ Performance entries were received after the beacon was sent.")))}}));var v=new Date(i);t.prepend(u("0 ms: Navigation started at ".concat(v.toLocaleDateString()," ").concat(v.toLocaleTimeString())))}function u(e,t){var n=document.createElement("li");return n.textContent=e,n.className=t||"",n}s.addEventListener("click",(function(){return d(i)})),l.forEach((function(e){e.addEventListener("change",(function(){return d(i)}))}))}();
