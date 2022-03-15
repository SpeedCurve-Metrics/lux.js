!function(){"use strict";var e={EvaluationStart:1,EvaluationEnd:2,InitCalled:3,MarkCalled:4,MeasureCalled:5,AddDataCalled:6,SendCalled:7,ForceSampleCalled:8,DataCollectionStart:9,UnloadHandlerTriggered:10,OnloadHandlerTriggered:11,SessionIsSampled:21,SessionIsNotSampled:22,MainBeaconSent:23,UserTimingBeaconSent:24,InteractionBeaconSent:25,CustomDataBeaconSent:26,NavigationStart:41,PerformanceEntryReceived:42,PerformanceEntryProcessed:43,PerformanceObserverError:51,InputEventPermissionError:52,InnerHtmlAccessError:53,EventTargetAccessError:54,CookieReadError:55,CookieSetError:56,PageLabelEvaluationError:57,NavTimingNotSupported:71,PaintTimingNotSupported:72},t=document.querySelector("#input"),n=document.querySelector("#event-counter"),r=document.querySelector("#output"),a=document.querySelector("#parse");if(!t||!r||!a)throw new Error("Cannot start debug parser.");function o(e){return e.map((function(e){return JSON.stringify(e)})).join(", ")}function i(e,t){var n=document.createElement("li");return n.textContent=e,n.className=t||"",n}a.addEventListener("click",(function(){r.innerHTML="";var a=[];try{a=JSON.parse(t.value)}catch(e){r.appendChild(i("Could not parse input: ".concat(e),"red"))}n.innerText="(".concat(a.length," events)");for(var c=Number(new Date(a[0][0])),s=0,l=a;s<l.length;s++){var u=l[s];if(u[1]===e.NavigationStart){c=u[2][0];break}}a.forEach((function(t){var n=Number(new Date(t[0]))-c,a=function(t){var n=Object.keys(e).find((function(n){return e[n]===t[1]})),r=t[2],a=n||"Unknown Event";r.length&&(a+=" (".concat(o(r),")"));switch(t[1]){case e.EvaluationStart:return"lux.js v".concat(r[0]," is initialising.");case e.EvaluationEnd:return"lux.js has finished initialising.";case e.InitCalled:return"LUX.init()";case e.MarkCalled:return"LUX.mark(".concat(o(r),")");case e.MeasureCalled:return"LUX.measure(".concat(o(r),")");case e.AddDataCalled:return"LUX.addData(".concat(o(r),")");case e.SendCalled:return"LUX.send()";case e.ForceSampleCalled:return"LUX.forceSample()";case e.DataCollectionStart:return"Beginning data collection. New events after this point may not be recorded for this page.";case e.UnloadHandlerTriggered:return"Unload handler was triggered.";case e.OnloadHandlerTriggered:return a="Onload handler was triggered after ".concat(r[0]," ms."),r[1]>0&&(a+="Minimum measure time was ".concat(r[1])),a;case e.SessionIsSampled:return"Sample rate is ".concat(r[0],"%. This session is being sampled.");case e.SessionIsNotSampled:return"Sample rate is ".concat(r[0],"%. This session is not being sampled.");case e.MainBeaconSent:return"Main beacon sent: ".concat(r[0]);case e.UserTimingBeaconSent:return"Supplementary user timing beacon sent: ".concat(r[0]);case e.InteractionBeaconSent:return"Supplementary user interaction beacon sent: ".concat(r[0]);case e.CustomDataBeaconSent:return"Supplementary custom data beacon sent: ".concat(r[0]);case e.NavigationStart:return"";case e.PerformanceEntryReceived:return"layout-shift"===r[0].entryType?"Received layout shift with value of ".concat(r[0].value.toFixed(3)):"longtask"===r[0].entryType?"Received long task with duration of ".concat(r[0].duration," ms"):"largest-contentful-paint"===r[0].entryType?"Received LCP entry at ".concat(r[0].startTime," ms"):"element"===r[0].entryType?"Received element timing entry for ".concat(r[0].identifier," at ").concat(r[0].startTime," ms"):"Received ".concat(r[0].entryType," entry");case e.PerformanceEntryProcessed:return"largest-contentful-paint"===r[0].entryType?"Picked LCP from entry at ".concat(r[0].startTime," ms"):"";case e.PerformanceObserverError:return"Error while initialising PerformanceObserver: ".concat(r[0]);case e.InputEventPermissionError:return"Error reading input event. Cannot calculate FID for this page.";case e.InnerHtmlAccessError:return"Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";case e.EventTargetAccessError:return"Error reading input event. Cannot calculate user interaction times for this page.";case e.CookieReadError:return"Error reading session cookie. This page will not be linked to a user session.";case e.CookieSetError:return"Error setting session cookie. This page will not be linked to a user session.";case e.PageLabelEvaluationError:return"Error while evaluating '".concat(r[0],"' for the page label: ").concat(r[1]);case e.NavTimingNotSupported:return"The Navigation Timing API is not supported. Performance metrics for this page will be limited.";case e.PaintTimingNotSupported:return"Start render time could not be determined."}return a}(t);a&&r.appendChild(i("".concat((new Intl.NumberFormat).format(n)," ms: ").concat(a)))}));var d=new Date(c);r.prepend(i("0 ms: Navigation started at ".concat(d.toLocaleDateString()," ").concat(d.toLocaleTimeString())))}))}();
