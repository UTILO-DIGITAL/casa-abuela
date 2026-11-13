# casa-abuela
Casa Abuela · calendario familiar (Utilo, T0471)

- `index.html`: la web (GitHub Pages). Llega a la web al fusionar en `main`.
- `apps-script/`: el código del proyecto de Apps Script «Casa Abuela» (desde T0479), que guarda en el Sheet. Fusionar no lo despliega: se sube con `clasp push` y se actualiza la implementación de la API con `clasp deploy -i <id de la URL de CASA_API>`, siempre antes de fusionar la web que lo necesita. Prueba: `node apps-script/probar.js apps-script/Código.js`.
