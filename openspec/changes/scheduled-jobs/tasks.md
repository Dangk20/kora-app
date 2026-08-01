# Tareas — trabajos programados

> Bloques de 2 horas o menos, verificables por sí solos.
> Evidencia obligatoria por tarea: prueba en verde, salida de comando o verificación contra el entorno real.

## 1. Registro de ejecuciones

- [ ] 1.1 Añadir al esquema la tabla de ejecuciones de trabajos: nombre, inicio, fin, duración, resultado (éxito / fallo / omitido), resumen y motivo del fallo. Índice por trabajo y fecha. Migración versionada.
- [ ] 1.2 Definir los tres trabajos en `src/modules/jobs/definitions.ts`: nombre, cadencia, tope de duración y la función que invocan — **la función, no el comando**: programador y ejecución manual comparten la misma lógica.

## 2. El programador

- [ ] 2.1 Implementar la decisión de "qué toca ahora": un trabajo corre si *ahora − última ejecución con éxito ≥ cadencia*, leyendo de la tabla. Resistente a reinicios y sin reponer ejecuciones perdidas.
- [ ] 2.2 Implementar el **cerrojo consultivo de PostgreSQL** por nombre de trabajo. Si no se obtiene, la ejecución se omite y se registra como omitida.
- [ ] 2.3 Implementar la ejecución con **tope de duración**: superado, se marca fallida por tiempo agotado y se libera el cerrojo.
- [ ] 2.4 Registrar la ejecución **al iniciar** y completarla al terminar, de modo que una ejecución sin fin registrado sea distinguible como "murió a mitad".
- [ ] 2.5 Aislar los fallos: un trabajo que lanza no detiene el programador ni impide que los demás corran.
- [ ] 2.6 Implementar la retención del historial, **preservando siempre la última ejecución con éxito de cada trabajo** — es la que sostiene el diagnóstico.

## 3. Pruebas de las invariantes

- [ ] 3.1 **No solapamiento:** dos programadores intentando el mismo trabajo a la vez → uno ejecuta, el otro registra omitido. Es el escenario del despliegue solapado, no una hipótesis.
- [ ] 3.2 **Cadencia desde la última ejecución:** un trabajo que corrió hace menos de su cadencia no se ejecuta; uno vencido, sí.
- [ ] 3.3 **Sin reponer:** un trabajo que lleva vencido varios intervalos corre **una sola vez**.
- [ ] 3.4 **Aislamiento de fallos:** un trabajo que lanza queda registrado como fallido y los demás corren igual.
- [ ] 3.5 **Tope de duración:** un trabajo que no termina se marca fallido por tiempo agotado y libera el cerrojo.
- [ ] 3.6 **Diagnóstico:** un trabajo sin ejecuciones se distingue de uno que corrió y falló; uno atrasado se señala como tal.
- [ ] 3.7 **Retención:** limpiar el historial no borra la última ejecución con éxito de cada trabajo.

## 4. Diagnóstico

- [ ] 4.1 Escribir `health.ts`: por trabajo, última ejecución con éxito, cuánto hace y si excede lo que su cadencia permite.
- [ ] 4.2 Añadir el comando `pnpm jobs:status`, con **código de salida distinto de cero** cuando algún trabajo esté atrasado o su última ejecución haya fallado — para poder encadenarlo a una comprobación automática cuando exista canal de alertas.

## 5. Integración con el worker

- [ ] 5.1 Añadir el disparo de trabajos al bucle del worker, sin que un trabajo lento retrase el consumo de eventos de forma apreciable.
- [ ] 5.2 Extender la **parada ordenada**: dejar de lanzar trabajos nuevos, esperar al que esté en curso, salir.
- [ ] 5.3 Añadir la variable de entorno que **desactiva el programador** sin tocar el consumo de eventos. Es la reversión del diseño.

## 6. Verificación de punta a punta

- [ ] 6.1 En local, con cadencias reducidas: arrancar el worker y comprobar que los tres trabajos se ejecutan y quedan registrados con su duración y resumen.
- [ ] 6.2 Crear un pedido, envejecerlo por debajo de su vigencia y comprobar que el trabajo **lo cancela**, que la transición aparece en el historial del pedido y que pasó por la máquina de estados.
- [ ] 6.3 Comprobar que un pedido en estado no cancelable **no se fuerza** y queda constancia.
- [ ] 6.4 Provocar una divergencia en el libro contable y comprobar que la verificación **la reporta y NO la corrige**.
- [ ] 6.5 Reiniciar el worker a mitad y comprobar que la cadencia se respeta desde la última ejecución, sin reponer las perdidas.
- [ ] 6.6 Verificar `pnpm jobs:status` en sus tres estados: al día, atrasado y sin ejecuciones.

## 7. Despliegue y cierre

- [ ] 7.1 Desplegar por el camino automático y comprobar en el servidor que los trabajos corren y quedan registrados en los dos entornos.
- [ ] 7.2 Actualizar `deploy/README.md`: los trabajos programados y cómo consultarlos.
- [ ] 7.3 Registrar en `../notas-tecnicas-privado.md` las deudas asumidas: un solo proceso sostiene worker y programador con su disparador para separarlos, y el diagnóstico existe pero **no avisa a nadie** mientras no haya canal.
- [ ] 7.4 Actualizar `../bitacora-sprints-kora.md`: cierra PED_HU003 y el job nocturno del DoD de S4.
- [ ] 7.5 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.
