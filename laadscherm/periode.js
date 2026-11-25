/* Kerkelijke periode op een datum: advent, kerst, pasen, hemel (Hemelvaart), pink (Pinksteren) of null.
   Werkt voor elk jaar (Pasen wordt berekend). Gebruik: onkPeriode(new Date()) -> {k,van,tot} of null. */
(function(){
  function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
  function add(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
  function periods(y){
    var E=easter(y),d24=new Date(y,11,24),fourth=add(d24,-d24.getDay()),first=add(fourth,-21);
    return [
      {k:"kerst",van:new Date(y,11,25),tot:new Date(y+1,0,6)},      /* 1e Kerstdag t/m Driekoningen */
      {k:"pasen",van:add(E,-2),tot:add(E,38)},                        /* Goede Vrijdag t/m woensdag voor Hemelvaart */
      {k:"hemel",van:add(E,39),tot:add(E,48)},                        /* Hemelvaartsdag t/m zaterdag voor Pinksteren */
      {k:"pink",van:add(E,49),tot:add(E,55)},                         /* Pinksterzondag t/m Pinksterweek */
      {k:"advent",van:first,tot:d24}                                  /* 1e adventszondag t/m 24 december */
    ];
  }
  function day(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
  window.onkPerioden=function(y){return periods(y)};
  window.onkPeriode=function(date){
    var t=day(date),y=date.getFullYear();
    for(var yy=y-1;yy<=y;yy++){var P=periods(yy);for(var i=0;i<P.length;i++)if(t>=day(P[i].van)&&t<=day(P[i].tot))return P[i]}
    return null;
  };
})();
