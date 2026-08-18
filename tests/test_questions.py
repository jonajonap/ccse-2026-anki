#!/usr/bin/env python3
"""
Unit tests para validar la integridad del banco de preguntas CCSE 2026.
"""

import json
import os
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, "preguntas_ccse_2026.json")
POR_TAREA_PATH = os.path.join(BASE_DIR, "preguntas_ccse_2026_por_tarea.json")


class TestCCSEDataset(unittest.TestCase):
    def setUp(self):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            self.data = json.load(f)

    def test_total_questions(self):
        preguntas = self.data.get("preguntas", [])
        self.assertEqual(len(preguntas), 300, "El banco debe contener exactamente 300 preguntas")

    def test_tasks_distribution_and_ranges(self):
        expected_tasks = {
            1: {"count": 120, "min": 1001, "max": 1120, "opts": 3},
            2: {"count": 36, "min": 2001, "max": 2036, "opts": 2},
            3: {"count": 24, "min": 3001, "max": 3024, "opts": 3},
            4: {"count": 36, "min": 4001, "max": 4036, "opts": 3},
            5: {"count": 84, "min": 5001, "max": 5084, "opts": 3},
        }

        task_counts = {}
        seen_ids = set()

        for q in self.data.get("preguntas", []):
            qid = q["id"]
            self.assertNotIn(qid, seen_ids, f"ID duplicado: {qid}")
            seen_ids.add(qid)

            tarea = q["tarea"]
            self.assertIn(tarea, expected_tasks, f"Tarea inválida: {tarea}")
            exp = expected_tasks[tarea]

            self.assertTrue(exp["min"] <= qid <= exp["max"], f"ID {qid} fuera de rango para tarea {tarea}")
            self.assertEqual(len(q["opciones"]), exp["opts"], f"Número de opciones erróneo en {qid}")
            self.assertIn(q["respuesta_correcta"], q["opciones"], f"Respuesta {q['respuesta_correcta']} no en opciones de {qid}")

            task_counts[tarea] = task_counts.get(tarea, 0) + 1

        for t, exp in expected_tasks.items():
            self.assertEqual(task_counts.get(t, 0), exp["count"], f"Conteo incorrecto en tarea {t}")

    def test_sync_por_tarea_file(self):
        self.assertTrue(os.path.exists(POR_TAREA_PATH), "preguntas_ccse_2026_por_tarea.json debe existir")
        with open(POR_TAREA_PATH, "r", encoding="utf-8") as f:
            data_por_tarea = json.load(f)

        total = sum(len(group["preguntas"]) for group in data_por_tarea.values())
        self.assertEqual(total, 300, "El desglose por tareas debe totalizar 300 preguntas")


if __name__ == "__main__":
    unittest.main()
