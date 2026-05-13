@AGENTS.md

# Consumo: usar SOLO el plan normal de la cuenta

**Nunca activar API extra ni overage**. Este proyecto se opera con el plan normal del usuario (Claude.ai Pro/Max/Team). No usar API directo de Anthropic ni "extra usage" facturable.

**Antes de cualquier operación que pueda gatillar extra usage, pausá y pedile autorización al usuario.** Ejemplos: builds muy largos, sub-agentes muy grandes, paralelismo masivo, retries de operaciones costosas.

Esta regla no implica downgrade de modelos — usá el modelo que la task requiera (Sonnet para complejidad real, Haiku para tasks chicas, Opus solo con autorización explícita). Lo importante es **no entrar en zona de billing extra sin avisar**.

Aplica también a futuras conversaciones en este proyecto.
