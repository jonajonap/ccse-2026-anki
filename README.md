# 🇪🇸 CCSE 2026 Anki SRS & Simulador Oficial

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-blue.svg)](LICENSE)
[![Edición: CCSE 2026](https://img.shields.io/badge/CCSE-Edici%C3%B3n%202026-emerald.svg)](#fuente-de-las-preguntas)
[![Preguntas: 300/300](https://img.shields.io/badge/Preguntas-300%20Oficiales-purple.svg)](#estructura-del-banco-de-preguntas)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-black?logo=github)](https://pages.github.com/)

Aplicación web interactiva, moderna y de código abierto para preparar y memorizar las **300 preguntas oficiales de la prueba CCSE 2026** (Conocimientos Constitucionales y Socioculturales de España) del Instituto Cervantes para la obtención de la nacionalidad española.

Utiliza el sistema de **Repetición Espaciada (SRS)** basado en el algoritmo **SuperMemo SM-2** (el mismo empleado por **Anki**), incluye un **catálogo completo clasificado por tareas** y un **simulador de examen oficial de 25 preguntas** con cronómetro y calificación en tiempo real.

---

## 📸 Demostración y Vistas Principales

1. **🧠 Modo Anki (SRS)**: Tarjetas con giro 3D, autoevaluación interactiva, 4 botones de calificación (*Otra vez*, *Difícil*, *Bien*, *Fácil*) y cálculo de intervalos exponenciales de memoria.
2. **📚 Catálogo de Preguntas por Categoría**: Explorador de las 300 preguntas con buscador en tiempo real, filtros por Tarea y visualizador de soluciones oficiales.
3. **📝 Simulador de Examen CCSE**: Prueba real con 25 preguntas ponderadas exactamente según la distribución del Instituto Cervantes, 45 minutos de tiempo límite y veredicto oficial (**APTO** con ≥15 aciertos).
4. **📊 Panel de Estadísticas y Racha**: Seguimiento de tarjetas dominadas, racha de días consecutivos estudiando y respaldo en JSON.

---

## ✨ Características Destacadas

- ⚡ **100% Estático y Ligero**: Construido con Vanilla JavaScript, HTML5 y Tailwind CSS. No requiere backend ni base de datos externa.
- 💾 **Persistencia Local y Privacidad Total**: Tu progreso se almacena exclusivamente en el `LocalStorage` de tu navegador. Tus datos nunca salen de tu dispositivo.
- 🔄 **Copias de Seguridad (Backup)**: Exporta e importa tu progreso en cualquier momento mediante archivos JSON.
- ⌨️ **Atajos de Teclado (Power Users)**:
  - <kbd>Espacio</kbd> / <kbd>Enter</kbd>: Girar tarjeta / Revelar solución.
  - <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd>: Calificar tarjeta (*Otra vez*, *Difícil*, *Bien*, *Fácil*).
  - <kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd>: Seleccionar opción en el anverso.
- 📱 **Diseño Responsivo y Modo Oscuro**: Optimizado para teléfonos móviles, tablets y ordenadores de escritorio con soporte para temas Claro / Oscuro.

---

## 📊 Estructura del Banco de Preguntas (300 Preguntas Oficiales)

El manual oficial CCSE 2026 se compone de 300 preguntas divididas en 5 tareas temáticas:

| Tarea | Nombre Oficial de la Tarea | Rango IDs | Preguntas | Tipo de Pregunta |
| :---: | :--- | :---: | :---: | :--- |
| **1** | Gobierno, legislación y participación ciudadana | 1001 – 1120 | 120 | Opción múltiple (3 opciones) |
| **2** | Derechos y deberes fundamentales | 2001 – 2036 | 36 | Verdadero / Falso (2 opciones) |
| **3** | Organización territorial. Geografía física y política | 3001 – 3024 | 24 | Opción múltiple (3 opciones) |
| **4** | Cultura e historia de España | 4001 – 4036 | 36 | Opción múltiple (3 opciones) |
| **5** | Sociedad española | 5001 – 5084 | 84 | Opción múltiple (3 opciones) |
| **Total** | | | **300** | **100% Solucionario Oficial** |

---

## 🚀 Despliegue en GitHub Pages (Gratis y en 2 Minutos)

Este proyecto está listo para ser publicado en **GitHub Pages**:

1. Haz un fork o sube este repositorio a tu cuenta de GitHub.
2. Ve a **Settings** (Ajustes) de tu repositorio.
3. En la barra lateral izquierda, entra en **Pages**.
4. En **Build and deployment** > **Branch**, selecciona `main` y la carpeta `/ (root)`.
5. Haz clic en **Save**. En un par de minutos, tu aplicación estará disponible en:
   ```
   https://TU_USUARIO.github.io/TU_REPOSITORIO/
   ```

---

## 💻 Ejecución en Local

Si deseas probar o modificar la aplicación en tu propio ordenador:

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/cervantes-ccse-2026.git
cd cervantes-ccse-2026

# 2. Iniciar un servidor web local sencillo con Python
python3 -m http.server 3000
```
Abre tu navegador en `http://localhost:3000`.

### Reextracción del PDF Oficial (Opcional)
Si deseas volver a extraer las preguntas del PDF original `manual-ccse-2026-def.pdf`:

```bash
# Crear entorno virtual e instalar dependencias
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Ejecutar script extractor y validador
python extract_ccse_questions.py
```

---

## 📖 Fuente de las Preguntas

El contenido de las preguntas y soluciones ha sido extraído del documento público oficial:
- **Título**: *Manual para la preparación de la prueba de conocimientos constitucionales y socioculturales de España (CCSE) 2026*.
- **Entidad emisora**: Instituto Cervantes.
- **Formato original**: Documento PDF distribuido públicamente para la preparación de los candidatos a la nacionalidad española por residencia.

---

## ⚖️ Descargo de Responsabilidad (Disclaimer Legal)

> [!IMPORTANT]
> **Aviso de no afiliación institucional:**
> 
> 1. Este proyecto es una **herramienta educativa independiente y de código abierto**, creada con fines didácticos por y para la comunidad de aspirantes a la nacionalidad española.
> 2. Este proyecto **NO** está afiliado, respaldado, asociado ni vinculado oficialmente con el **Instituto Cervantes**, el **Ministerio de Justicia de España**, ni con ningún otro organismo o ministerio del **Gobierno de España**.
> 3. Las marcas, nombres comerciales y siglas (*CCSE*, *Instituto Cervantes*) son propiedad exclusiva de sus respectivos titulares y se mencionan aquí únicamente con fines informativos e identificativos conforme a los usos legítimos y normativas de cita.
> 4. Aunque el banco de datos ha sido extraído y verificado rigurosamente contra el solucionario oficial de 2026, los desarrolladores no asumen responsabilidad por posibles cambios normativos, erratas o resultados obtenidos en las convocatorias oficiales del examen. Siempre se recomienda contrastar con el portal oficial del Instituto Cervantes ([ccse.cervantes.es](https://ccse.cervantes.es/)).

---

## 📄 Licencia y Atribución

Este proyecto está bajo la licencia **MIT**. Puedes usarlo, compartirlo, modificarlo y alojarlo libremente de forma gratuita, siempre que **mantengas los créditos y el aviso de licencia original**.

```text
MIT License

Copyright (c) 2026 jonajonap & colaboradores de la comunidad

Se concede permiso por la presente, sin cargo, a cualquier persona que obtenga una copia
de este software y de los archivos de documentación asociados...
```
Consulta el archivo [LICENSE](LICENSE) para más detalles.
