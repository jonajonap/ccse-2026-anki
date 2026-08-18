#!/usr/bin/env python3
"""
Extractor y validador de preguntas y respuestas oficiales del Manual CCSE 2026 (Instituto Cervantes).
Convierte el manual oficial en formato PDF a archivos JSON estructurados.
"""

import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Tuple
import pymupdf


TASKS_CONFIG = [
    {
        "tarea_num": 1,
        "nombre": "Gobierno, legislación y participación ciudadana",
        "pages": (18, 26),
        "min_id": 1001,
        "max_id": 1120,
        "tipo": "opcion_multiple",
        "num_opciones": 3,
    },
    {
        "tarea_num": 2,
        "nombre": "Derechos y deberes fundamentales",
        "pages": (33, 35),
        "min_id": 2001,
        "max_id": 2036,
        "tipo": "verdadero_falso",
        "num_opciones": 2,
    },
    {
        "tarea_num": 3,
        "nombre": "Organización territorial de España. Geografía física y política",
        "pages": (43, 44),
        "min_id": 3001,
        "max_id": 3024,
        "tipo": "opcion_multiple",
        "num_opciones": 3,
    },
    {
        "tarea_num": 4,
        "nombre": "Cultura e historia de España",
        "pages": (66, 68),
        "min_id": 4001,
        "max_id": 4036,
        "tipo": "opcion_multiple",
        "num_opciones": 3,
    },
    {
        "tarea_num": 5,
        "nombre": "Sociedad española",
        "pages": (92, 98),
        "min_id": 5001,
        "max_id": 5084,
        "tipo": "opcion_multiple",
        "num_opciones": 3,
    },
]

HEADER_FOOTER_PATTERNS = [
    r"^Tarea \d.*$",
    r"^Instituto Cervantes.*$",
    r"^Manual de preparación de la prueba CCSE.*$",
    r"^2026$",
    r"^\d{1,3}$",
    r"^PREGUNTAS$",
    r"^Gobierno, legislación y participación ciudadana$",
    r"^Derechos y deberes fundamentales$",
    r"^Organización territorial de España.*$",
    r"^Cultura e historia de España.*$",
    r"^Sociedad española.*$",
    r"^SOLUCIONES$",
    r"^Solucionario de las preguntas$",
]


def extract_solucionario(doc: pymupdf.Document) -> Dict[int, str]:
    """Extrae las soluciones oficiales de las páginas finales del manual (páginas 99 a 101)."""
    answers = {}
    solucionario_pages = [98, 99, 100]  # Índices 0-indexed (páginas 99, 100, 101)

    for p in solucionario_pages:
        if p >= len(doc):
            continue
        text = doc[p].get_text()
        tokens = text.split()
        for i in range(len(tokens) - 1):
            if re.match(r"^[1-5]\d{3}$", tokens[i]) and tokens[i + 1].lower() in ["a", "b", "c"]:
                answers[int(tokens[i])] = tokens[i + 1].lower()

    return answers


def clean_page_lines(page_text: str) -> List[str]:
    """Limpia encabezados, pies de página y elementos no relevantes del texto de la página."""
    lines = page_text.split("\n")
    cleaned = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        is_hf = any(re.match(pat, line, re.IGNORECASE) for pat in HEADER_FOOTER_PATTERNS)
        if not is_hf:
            cleaned.append(line)
    return cleaned


def parse_questions_for_task(
    doc: pymupdf.Document,
    tinfo: Dict[str, Any],
    answers: Dict[int, str]
) -> List[Dict[str, Any]]:
    """Parsea todas las preguntas de una tarea específica."""
    task_lines: List[str] = []
    start_p, end_p = tinfo["pages"]
    for p in range(start_p - 1, end_p):
        task_lines.extend(clean_page_lines(doc[p].get_text()))

    valid_ids = set(range(tinfo["min_id"], tinfo["max_id"] + 1))
    q_positions: List[Tuple[int, int, str]] = []

    for idx, line in enumerate(task_lines):
        m = re.match(r"^([1-5]\d{3})\b\s*(.*)$", line)
        if m:
            qid = int(m.group(1))
            if qid in valid_ids:
                q_positions.append((idx, qid, m.group(2)))

    questions: List[Dict[str, Any]] = []

    for i, (line_idx, q_id, rem_line) in enumerate(q_positions):
        end_idx = q_positions[i + 1][0] if i + 1 < len(q_positions) else len(task_lines)
        chunk: List[str] = []
        if rem_line.strip():
            chunk.append(rem_line.strip())
        chunk.extend(task_lines[line_idx + 1 : end_idx])

        q_text_parts: List[str] = []
        options: Dict[str, str] = {}
        current_opt = None

        for cl in chunk:
            opt_m = re.match(r"^([a-c])[\.\)]\s*(.*)$", cl, re.IGNORECASE)
            if opt_m:
                current_opt = opt_m.group(1).lower()
                options[current_opt] = opt_m.group(2).strip()
            elif current_opt:
                options[current_opt] = (options[current_opt] + " " + cl).strip()
            else:
                q_text_parts.append(cl)

        q_text = re.sub(r"\s+", " ", " ".join(q_text_parts)).strip()
        for k in options:
            options[k] = re.sub(r"\s+", " ", options[k])

        corr_ans = answers.get(q_id)
        corr_text = options.get(corr_ans, "") if corr_ans else ""

        questions.append({
            "id": q_id,
            "tarea": tinfo["tarea_num"],
            "tarea_nombre": tinfo["nombre"],
            "tipo": tinfo["tipo"],
            "pregunta": q_text,
            "opciones": options,
            "respuesta_correcta": corr_ans,
            "respuesta_correcta_texto": corr_text,
        })

    return questions


def validate_dataset(questions: List[Dict[str, Any]], answers: Dict[int, str]) -> List[str]:
    """Realiza validaciones exhaustivas sobre las preguntas extraídas."""
    errors = []

    if len(questions) != 300:
        errors.append(f"Se esperaban 300 preguntas, pero se obtuvieron {len(questions)}.")

    if len(answers) != 300:
        errors.append(f"Se esperaban 300 respuestas en el solucionario, pero se obtuvieron {len(answers)}.")

    found_ids = set(q["id"] for q in questions)
    expected_ids = set()
    for tinfo in TASKS_CONFIG:
        expected_ids.update(range(tinfo["min_id"], tinfo["max_id"] + 1))

    missing_ids = expected_ids - found_ids
    if missing_ids:
        errors.append(f"IDs de preguntas faltantes: {sorted(list(missing_ids))}")

    for q in questions:
        qid = q["id"]
        tipo = q["tipo"]
        opts = q["opciones"]

        if not q["pregunta"]:
            errors.append(f"Q{qid}: Enunciado de pregunta vacío.")

        if tipo == "verdadero_falso":
            if set(opts.keys()) != {"a", "b"}:
                errors.append(f"Q{qid} (V/F): Opciones inválidas {list(opts.keys())}")
        elif tipo == "opcion_multiple":
            if set(opts.keys()) != {"a", "b", "c"}:
                errors.append(f"Q{qid} (Opción Múltiple): Opciones inválidas {list(opts.keys())}")

        if not q["respuesta_correcta"] or q["respuesta_correcta"] not in opts:
            errors.append(f"Q{qid}: Clave de respuesta correcta inválida ({q['respuesta_correcta']}).")

        if not q["respuesta_correcta_texto"]:
            errors.append(f"Q{qid}: Texto de respuesta correcta vacío.")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Extraer preguntas CCSE 2026 a formato JSON.")
    parser.add_argument(
        "--pdf",
        default="manual-ccse-2026-def.pdf",
        help="Ruta al archivo PDF del manual CCSE 2026.",
    )
    parser.add_argument(
        "--out",
        default="preguntas_ccse_2026.json",
        help="Ruta del archivo JSON de salida (lista completa con metadatos).",
    )
    parser.add_argument(
        "--out-by-task",
        default="preguntas_ccse_2026_por_tarea.json",
        help="Ruta del archivo JSON agrupado por tareas.",
    )

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"Error: No se encontró el archivo PDF en '{args.pdf}'", file=sys.stderr)
        sys.exit(1)

    print(f"Abriendo PDF: {args.pdf}")
    doc = pymupdf.open(args.pdf)
    print(f"Total de páginas: {len(doc)}")

    print("Extrayendo solucionario oficial...")
    answers = extract_solucionario(doc)
    print(f"Respuestas oficiales extraídas: {len(answers)}/300")

    all_questions: List[Dict[str, Any]] = []
    questions_by_task: Dict[str, Any] = {}

    for tinfo in TASKS_CONFIG:
        task_q = parse_questions_for_task(doc, tinfo, answers)
        # Ordenar por ID dentro de la tarea
        task_q.sort(key=lambda x: x["id"])
        all_questions.extend(task_q)
        questions_by_task[str(tinfo["tarea_num"])] = {
            "tarea": tinfo["tarea_num"],
            "nombre": tinfo["nombre"],
            "tipo": tinfo["tipo"],
            "total_preguntas": len(task_q),
            "preguntas": task_q,
        }
        print(f"  - Tarea {tinfo['tarea_num']} ({tinfo['nombre']}): {len(task_q)} preguntas extraídas.")

    # Ordenar todas las preguntas globalmente por ID
    all_questions.sort(key=lambda x: x["id"])

    print("Validando integridad del conjunto de datos...")
    validation_errors = validate_dataset(all_questions, answers)

    if validation_errors:
        print(f"\n[ERROR] Se encontraron {len(validation_errors)} errores de validación:", file=sys.stderr)
        for err in validation_errors[:10]:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    print("[OK] Validación 100% exitosa sin errores.")

    # Crear estructura final con metadatos
    dataset = {
        "metadata": {
            "titulo": "Prueba de Conocimientos Constitucionales y Socioculturales de España (CCSE)",
            "edicion": 2026,
            "fuente": "Instituto Cervantes",
            "total_preguntas": len(all_questions),
            "tareas": [
                {
                    "id": tinfo["tarea_num"],
                    "nombre": tinfo["nombre"],
                    "tipo": tinfo["tipo"],
                    "total": tinfo["max_id"] - tinfo["min_id"] + 1,
                    "rango_ids": [tinfo["min_id"], tinfo["max_id"]],
                }
                for tinfo in TASKS_CONFIG
            ],
        },
        "preguntas": all_questions,
    }

    # Guardar JSON completo
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    print(f"Archivo guardado: {args.out} ({os.path.getsize(args.out):,} bytes)")

    # Guardar JSON agrupado por tareas
    with open(args.out_by_task, "w", encoding="utf-8") as f:
        json.dump(questions_by_task, f, ensure_ascii=False, indent=2)
    print(f"Archivo guardado: {args.out_by_task} ({os.path.getsize(args.out_by_task):,} bytes)")

    print("\n¡Proceso de extracción y exportación completado exitosamente!")


if __name__ == "__main__":
    main()
