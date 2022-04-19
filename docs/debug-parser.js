!function(){"use strict";var e={EvaluationStart:1,EvaluationEnd:2,InitCalled:3,MarkCalled:4,MeasureCalled:5,AddDataCalled:6,SendCalled:7,ForceSampleCalled:8,DataCollectionStart:9,UnloadHandlerTriggered:10,OnloadHandlerTriggered:11,SessionIsSampled:21,SessionIsNotSampled:22,MainBeaconSent:23,UserTimingBeaconSent:24,InteractionBeaconSent:25,CustomDataBeaconSent:26,NavigationStart:41,PerformanceEntryReceived:42,PerformanceEntryProcessed:43,PerformanceObserverError:51,InputEventPermissionError:52,InnerHtmlAccessError:53,EventTargetAccessError:54,CookieReadError:55,CookieSetError:56,PageLabelEvaluationError:57,NavTimingNotSupported:71,PaintTimingNotSupported:72};function t(e){return e.map((function(e){return JSON.stringify(e)})).join(", ")}var n=document.querySelector("#input"),r=document.querySelector("#event-counter"),a=document.querySelector("#output"),o=document.querySelector("#parse"),i=document.querySelectorAll(".event-filter");if(!n||!a||!o)throw new Error("Cannot start debug parser.");function c(a){a.innerHTML="";var o=[];try{o=JSON.parse(n.value)}catch(e){a.appendChild(s("Could not parse input: ".concat(e),"red"))}r.innerText="(".concat(o.length," events)");for(var c=Number(new Date(o[0][0])),l=0,u=o;l<u.length;l++){var d=u[l];if(d[1]===e.NavigationStart){c=d[2][0];break}}var m=function(e){var t=[];return e.forEach((function(e){var n=e.getAttribute("data-event");e.checked&&n&&t.push(n)})),t}(i);o.forEach((function(n){var r=Number(new Date(n[0]))-c,o=function(n,r){var a=Object.keys(e).find((function(t){return e[t]===n[1]})),o=n[2],i=a||"Unknown Event";switch(o.length&&(i+=" (".concat(t(o),")")),n[1]){case e.EvaluationStart:return"lux.js v".concat(o[0]," is initialising.");case e.EvaluationEnd:return"lux.js has finished initialising.";case e.InitCalled:return"LUX.init()";case e.MarkCalled:return r.includes("userTiming")?"LUX.mark(".concat(t(o),")"):"";case e.MeasureCalled:return r.includes("userTiming")?"LUX.measure(".concat(t(o),")"):"";case e.AddDataCalled:return r.includes("addData")?"LUX.addData(".concat(t(o),")"):"";case e.SendCalled:return"LUX.send()";case e.ForceSampleCalled:return"LUX.forceSample()";case e.DataCollectionStart:return"Beginning data collection. New events after this point may not be recorded for this page.";case e.UnloadHandlerTriggered:return"Unload handler was triggered.";case e.OnloadHandlerTriggered:return i="Onload handler was triggered after ".concat(o[0]," ms."),o[1]>0&&(i+="Minimum measure time was ".concat(o[1])),i;case e.SessionIsSampled:return"Sample rate is ".concat(o[0],"%. This session is being sampled.");case e.SessionIsNotSampled:return"Sample rate is ".concat(o[0],"%. This session is not being sampled.");case e.MainBeaconSent:return i="Main beacon sent",r.includes("beaconUrl")&&(i+=": ".concat(o[0])),i;case e.UserTimingBeaconSent:return i="Supplementary user timing beacon sent",r.includes("beaconUrl")&&(i+=": ".concat(o[0])),i;case e.InteractionBeaconSent:return i="Supplementary user interaction beacon sent",r.includes("beaconUrl")&&(i+=": ".concat(o[0])),i;case e.CustomDataBeaconSent:return i="Supplementary custom data beacon sent",r.includes("beaconUrl")&&(i+=": ".concat(o[0])),i;case e.NavigationStart:return"";case e.PerformanceEntryReceived:return"layout-shift"===o[0].entryType?"Received layout shift at ".concat(o[0].startTime.toFixed()," ms with value of ").concat(o[0].value.toFixed(3)):"longtask"===o[0].entryType?"Received long task with duration of ".concat(o[0].duration," ms"):"largest-contentful-paint"===o[0].entryType?"Received LCP entry at ".concat(o[0].startTime.toFixed()," ms"):"element"===o[0].entryType?"Received element timing entry for ".concat(o[0].identifier," at ").concat(o[0].startTime.toFixed()," ms"):(i="Received ".concat(o[0].entryType," entry"),o[0].startTime&&(i+=" at ".concat(o[0].startTime.toFixed()," ms")),i);case e.PerformanceEntryProcessed:return"largest-contentful-paint"===o[0].entryType?"Picked LCP from entry at ".concat(o[0].startTime.toFixed()," ms"):"";case e.PerformanceObserverError:return"Error while initialising PerformanceObserver: ".concat(o[0]);case e.InputEventPermissionError:return"Error reading input event. Cannot calculate FID for this page.";case e.InnerHtmlAccessError:return"Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";case e.EventTargetAccessError:return"Error reading input event. Cannot calculate user interaction times for this page.";case e.CookieReadError:return"Error reading session cookie. This page will not be linked to a user session.";case e.CookieSetError:return"Error setting session cookie. This page will not be linked to a user session.";case e.PageLabelEvaluationError:return"Error while evaluating '".concat(o[0],"' for the page label: ").concat(o[1]);case e.NavTimingNotSupported:return"The Navigation Timing API is not supported. Performance metrics for this page will be limited.";case e.PaintTimingNotSupported:return"Start render time could not be determined."}return i}(n,m);o&&a.appendChild(s("".concat((new Intl.NumberFormat).format(r)," ms: ").concat(o)))}));var p=new Date(c);a.prepend(s("0 ms: Navigation started at ".concat(p.toLocaleDateString()," ").concat(p.toLocaleTimeString())))}function s(e,t){var n=document.createElement("li");return n.textContent=e,n.className=t||"",n}o.addEventListener("click",(function(){return c(a)})),i.forEach((function(e){e.addEventListener("change",(function(){return c(a)}))}))}();
