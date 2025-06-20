# Arabic Miracle — Centralized Documentation and Integration Guide

## Overview
Arabic Miracle is a dynamic tool for analyzing Arabic text. Users can input words or sentences to receive:
- **Morphological Analysis:** Extraction of root letters and identification of root meanings.
- **Context-Aware Translation:** A full translation of the input along with contextual nuances.
- **Quranic Analysis:** Information on how frequently the identified root appears in the Quran, including sample verses.
- **Morphological Weighting:** Displaying the word's pattern (وزن صرفي) with highlighted root letters.

This document serves to document the overall project architecture and the interaction between its two independent repositories.

---

## Repository Structure

The project is organized into two separate repositories:
- **arabic-miracle-ui:**  
  Contains the frontend code (built with Vite and React) that provides a user interface for text input and displays the analysis results.

- **arabic-miracle-api:**  
  Contains the backend code built with Flask. This repository exposes an HTTP endpoint (`/analyze`) that processes the text and returns analysis data in JSON format.

---

## API Documentation

### Endpoint: `/analyze`
- **Method:** POST  
- **Description:** Analyzes the provided Arabic text and returns a structured response including:
  1. The root letters (in Arabic).
  2. The English meaning of those root letters.
  3. A context-aware, full sentence translation.
  4. Quranic occurrence details including sample verses.
  5. The morphological weight/pattern (وزن صرفي), with highlighted root letters.

- **Request Body (JSON):**
  ```json
  {
    "text": "Your Arabic word or sentence"
  }
