"""Measurements (meters) taken from Character_Sheet_1_Peachi.png.

Blender space: Z up, character faces -Y, her left side is +X, ground = 0.
Front view scale: 1.60 m (crown..sole incl. platform shoes) = 4840 px of the sheet crop.
"""
import math
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHEET = os.path.join(ROOT, 'Character_Sheet_1_Peachi.png')
OUT_DIR = os.path.join(ROOT, 'assets', 'models')
TEX_DIR = os.path.join(ROOT, 'tools', 'blender', 'tex')

HEIGHT = 1.60

# ---- landmark heights
Z_EAR_TIP = 1.655
Z_CROWN = 1.600
Z_EYE = 1.443
Z_NOSE = 1.421
Z_MOUTH = 1.394
Z_CHIN = 1.3615
Z_CHOKER = 1.350
Z_COLLAR = 1.318
Z_SHOULDER = 1.300
Z_BUST = 1.212
Z_UNDERBUST = 1.125
Z_WAIST = 1.079
Z_NAVEL = 1.037
Z_BELT = 1.008
Z_HIP = 0.900
Z_CROTCH = 0.818
Z_SKIRT_HEM = 0.765
Z_GARTER = 0.672
Z_KNEE = 0.505
Z_ANKLE = 0.112
SOLE = 0.040          # platform thickness

# ---- skeleton joints (left side; right side is mirrored)
ARM_ANGLE = math.radians(30.0)   # rest pose: arms 30 deg from vertical (A-pose)
J = {
    'Hips': (0.0, 0.004, 0.905),
    'Spine': (0.0, 0.006, 0.985),
    'Spine1': (0.0, 0.008, 1.080),
    'Spine2': (0.0, 0.006, 1.185),
    'Neck': (0.0, 0.006, 1.318),
    'Head': (0.0, 0.002, 1.392),
    'HeadTop': (0.0, -0.010, 1.600),
    'Shoulder': (0.018, 0.000, 1.296),
    'Arm': (0.112, 0.006, 1.276),
    'UpLeg': (0.068, 0.002, 0.862),
    'Leg': (0.083, -0.003, 0.505),
    'Foot': (0.097, 0.040, 0.112),
    'Toe': (0.099, -0.052, 0.040),
    'ToeEnd': (0.100, -0.092, 0.040),
}
UPPER_ARM = 0.268
FOREARM = 0.236
ARM_DIR = (math.sin(ARM_ANGLE), 0.0, -math.cos(ARM_ANGLE))
J['ForeArm'] = (J['Arm'][0] + UPPER_ARM * ARM_DIR[0], J['Arm'][1] + 0.012, J['Arm'][2] + UPPER_ARM * ARM_DIR[2])
J['Hand'] = (J['ForeArm'][0] + FOREARM * ARM_DIR[0], J['ForeArm'][1] + 0.004, J['ForeArm'][2] + FOREARM * ARM_DIR[2])

# ---- palette (sRGB, sampled from the sheet)
PAL = {
    'skin': (1.0, 0.855, 0.78),
    'skin_shade': (0.95, 0.66, 0.62),
    'hair_root': (0.19, 0.095, 0.075),
    'hair_mid': (0.36, 0.16, 0.12),
    'hair_warm': (0.54, 0.22, 0.19),
    'hair_pink': (0.93, 0.43, 0.58),
    'hair_tip': (0.99, 0.66, 0.77),
    'pink': (1.0, 0.49, 0.71),
    'pink_hot': (0.98, 0.33, 0.55),
    'pink_pale': (1.0, 0.80, 0.88),
    'white': (0.98, 0.965, 0.99),
    'lavender': (0.84, 0.80, 0.98),
    'black': (0.10, 0.10, 0.16),
    'navy': (0.16, 0.17, 0.30),
    'gold': (0.96, 0.74, 0.24),
    'eye': (0.88, 0.46, 0.12),
}
