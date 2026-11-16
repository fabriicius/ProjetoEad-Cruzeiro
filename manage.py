#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv

load_dotenv()
settings_module = "offlab.test_settings" if len(sys.argv) > 1 and sys.argv[1] == "test" else "offlab.settings"
os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)
from django.core.management import execute_from_command_line
execute_from_command_line(sys.argv)
