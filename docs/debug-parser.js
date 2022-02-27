!function(){"use strict";var e={EvaluationStart:1,EvaluationEnd:2,InitCalled:3,MarkCalled:4,MeasureCalled:5,AddDataCalled:6,SendCalled:7,ForceSampleCalled:8,DataCollectionStart:9,UnloadHandlerTriggered:10,OnloadHandlerTriggered:11,SessionIsSampled:21,SessionIsNotSampled:22,MainBeaconSent:23,UserTimingBeaconSent:24,InteractionBeaconSent:25,CustomDataBeaconSent:26,PerformanceObserverError:51,InputEventPermissionError:52,InnerHtmlAccessError:53,EventTargetAccessError:54,CookieReadError:55,CookieSetError:56,PageLabelEvaluationError:57,NavTimingNotSupported:71,PaintTimingNotSupported:72},n=document.querySelector("#input"),r=document.querySelector("#output"),a=document.querySelector("#parse");if(!n||!r||!a)throw new Error("Cannot start debug parser.");function t(e,n){var r=document.createElement("li");return r.textContent=e,r.className=n||"",r}a.addEventListener("click",(function(){r.innerHTML="";var a=[];try{a=JSON.parse(n.value)}catch(e){r.appendChild(t("Could not parse input: ".concat(e),"red"))}a.forEach((function(n){var a=new Date(n[0]),o="".concat(a.toLocaleDateString()," ").concat(a.toLocaleTimeString());r.appendChild(t("".concat(o,": ").concat(function(n){var r=Object.keys(e).find((function(r){return e[r]===n[1]})),a=n[2],t=r||"Unknown Event";a.length&&(t+=" (".concat(a.join(", "),")"));switch(n[1]){case e.EvaluationStart:return"lux.js v".concat(a[0]," is initialising.");case e.EvaluationEnd:return"lux.js has finished initialising.";case e.InitCalled:return"LUX.init()";case e.MarkCalled:return"LUX.mark(".concat(a.join(", "),")");case e.MeasureCalled:return"LUX.measure(".concat(a.join(", "),")");case e.AddDataCalled:return"LUX.addData(".concat(a.join(", "),")");case e.SendCalled:return"LUX.send()";case e.ForceSampleCalled:return"LUX.forceSample()";case e.DataCollectionStart:return"Beginning data collection. Events after this point may not be recorded for this page.";case e.UnloadHandlerTriggered:return"Unload handler was triggered.";case e.OnloadHandlerTriggered:return t="Onload handler was triggered after ".concat(a[0]," ms."),a[1]>0&&(t+="Minimum measure time was ".concat(a[1])),t;case e.SessionIsSampled:return"Sample rate is ".concat(a[0],"%. This session is being sampled.");case e.SessionIsNotSampled:return"Sample rate is ".concat(a[0],"%. This session is not being sampled.");case e.MainBeaconSent:return"Main beacon sent: ".concat(a[0]);case e.UserTimingBeaconSent:return"Supplementary user timing beacon sent: ".concat(a[0]);case e.InteractionBeaconSent:return"Supplementary user interaction beacon sent: ".concat(a[0]);case e.CustomDataBeaconSent:return"Supplementary custom data beacon sent: ".concat(a[0]);case e.PerformanceObserverError:return"Error while initialising PerformanceObserver: ".concat(a[0]);case e.InputEventPermissionError:return"Error reading input event. Cannot calculate FID for this page.";case e.InnerHtmlAccessError:return"Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";case e.EventTargetAccessError:return"Error reading input event. Cannot calculate user interaction times for this page.";case e.CookieReadError:return"Error reading session cookie. This page will not be linked to a user session.";case e.CookieSetError:return"Error setting session cookie. This page will not be linked to a user session.";case e.PageLabelEvaluationError:return"Error while evaluating '".concat(a[0],"' for the page label: ").concat(a[1]);case e.NavTimingNotSupported:return"The Navigation Timing API is not supported. Performance metrics for this page will be limited.";case e.PaintTimingNotSupported:return"Start render time could not be determined."}return t}(n))))}))}))}();
