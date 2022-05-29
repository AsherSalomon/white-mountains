
// https://www.w3schools.com/html/html5_webworkers.asp
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

var i = 0;

function timedCount() {
  i = i + 1;
  postMessage(i);
  setTimeout("timedCount()",500);
}

timedCount();

onmessage = function(e) {
  console.log( e.data );
}
