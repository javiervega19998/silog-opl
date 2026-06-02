async function check() {
  const res = await fetch('https://silog-opl-681dc.web.app/viajes.html');
  const text = await res.text();
  console.log("IndexOf select patente:", text.indexOf('<select class="field" id="patente"'));
  console.log("IndexOf source server:", text.indexOf("source: 'server'"));
}
check();
