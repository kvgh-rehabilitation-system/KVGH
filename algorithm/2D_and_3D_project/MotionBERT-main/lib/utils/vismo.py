import numpy as np
import os
import cv2
import math
import copy
import imageio
import io
from tqdm import tqdm
from PIL import Image
from lib.utils.tools import ensure_dir
import matplotlib
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from lib.utils.utils_smpl import *
import ipdb

def render_and_save(motion_input, save_path, keep_imgs=False, fps=25, color="#F96706#FB8D43#FDB381", with_conf=False, draw_face=False):
    ensure_dir(os.path.dirname(save_path))
    motion = copy.deepcopy(motion_input)
    if motion.shape[-1]==2 or motion.shape[-1]==3:
        motion = np.transpose(motion, (1,2,0))   #(T,17,D) -> (17,D,T) 
    if motion.shape[1]==2 or with_conf:
        colors = hex2rgb(color)
        if not with_conf:
            J, D, T = motion.shape
            motion_full = np.ones([J,3,T])
            motion_full[:,:2,:] = motion
        else:
            motion_full = motion
        motion_full[:,:2,:] = pixel2world_vis_motion(motion_full[:,:2,:])
        motion2video(motion_full, save_path=save_path, colors=colors, fps=fps)
    elif motion.shape[0]==6890:
        # motion_world = pixel2world_vis_motion(motion, dim=3)
        motion2video_mesh(motion, save_path=save_path, keep_imgs=keep_imgs, fps=fps, draw_face=draw_face)
    else:
        motion_world = pixel2world_vis_motion(motion, dim=3)
        motion2video_3d(motion_world, save_path=save_path, keep_imgs=keep_imgs, fps=fps)
        
def pixel2world_vis(pose):
#     pose: (17,2)
    return (pose + [1, 1]) * 512 / 2

def pixel2world_vis_motion(motion, dim=2, is_tensor=False):
#     pose: (17,2,N)
    N = motion.shape[-1]
    if dim==2:
        offset = np.ones([2,N]).astype(np.float32)
    else:
        offset = np.ones([3,N]).astype(np.float32)
        offset[2,:] = 0
    if is_tensor:
        offset = torch.tensor(offset)
    return (motion + offset) * 512 / 2

def vis_data_batch(data_input, data_label, n_render=10, save_path='doodle/vis_train_data/'):
    '''
        data_input: [N,T,17,2/3]
        data_label: [N,T,17,3]
    '''
    pathlib.Path(save_path).mkdir(parents=True, exist_ok=True) 
    for i in range(min(len(data_input), n_render)):
        render_and_save(data_input[i][:,:,:2], '%s/input_%d.mp4' % (save_path, i))
        render_and_save(data_label[i], '%s/gt_%d.mp4' % (save_path, i))

def get_img_from_fig(fig, dpi=120):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", pad_inches=0)
    buf.seek(0)
    img_arr = np.frombuffer(buf.getvalue(), dtype=np.uint8)
    buf.close()
    img = cv2.imdecode(img_arr, 1)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA)
    return img

def rgb2rgba(color):
    return (color[0], color[1], color[2], 255)

def hex2rgb(hex, number_of_colors=3):
    h = hex
    rgb = []
    for i in range(number_of_colors):
        h = h.lstrip('#')
        hex_color = h[0:6]
        rgb_color = [int(hex_color[i:i+2], 16) for i in (0, 2 ,4)]
        rgb.append(rgb_color)
        h = h[6:]
    return rgb

def joints2image(joints_position, colors, transparency=False, H=1000, W=1000, nr_joints=49, imtype=np.uint8, grayscale=False, bg_color=(255, 255, 255)):
#     joints_position: [17*2]
    nr_joints = joints_position.shape[0]

    if nr_joints == 49: # full joints(49): basic(15) + eyes(2) + toes(2) + hands(30)
        limbSeq = [[0, 1], [1, 2], [1, 5], [1, 8], [2, 3], [3, 4], [5, 6], [6, 7], \
                   [8, 9], [8, 13], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16],
                   ]#[0, 17], [0, 18]] #ignore eyes

        L = rgb2rgba(colors[0]) if transparency else colors[0]
        M = rgb2rgba(colors[1]) if transparency else colors[1]
        R = rgb2rgba(colors[2]) if transparency else colors[2]

        colors_joints = [M, M, L, L, L, R, R,
                  R, M, L, L, L, L, R, R, R,
                  R, R, L] + [L] * 15 + [R] * 15

        colors_limbs = [M, L, R, M, L, L, R,
                  R, L, R, L, L, L, R, R, R,
                  R, R]
    elif nr_joints == 15: # basic joints(15) + (eyes(2))
        limbSeq = [[0, 1], [1, 2], [1, 5], [1, 8], [2, 3], [3, 4], [5, 6], [6, 7],
                   [8, 9], [8, 12], [9, 10], [10, 11], [12, 13], [13, 14]]
                    # [0, 15], [0, 16] two eyes are not drawn

        L = rgb2rgba(colors[0]) if transparency else colors[0]
        M = rgb2rgba(colors[1]) if transparency else colors[1]
        R = rgb2rgba(colors[2]) if transparency else colors[2]

        colors_joints = [M, M, L, L, L, R, R,
                         R, M, L, L, L, R, R, R]

        colors_limbs = [M, L, R, M, L, L, R,
                        R, L, R, L, L, R, R]
    elif nr_joints == 17: # H36M, 0: 'root',
    #                             1: 'rhip',
    #                             2: 'rkne',
    #                             3: 'rank',
    #                             4: 'lhip',
    #                             5: 'lkne',
    #                             6: 'lank',
    #                             7: 'belly',
    #                             8: 'neck',
    #                             9: 'nose',
    #                             10: 'head',
    #                             11: 'lsho',
    #                             12: 'lelb',
    #                             13: 'lwri',
    #                             14: 'rsho',
    #                             15: 'relb',
    #                             16: 'rwri'
        limbSeq = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [0, 7], [7, 8], [8, 9], [8, 11], [8, 14], [9, 10], [11, 12], [12, 13], [14, 15], [15, 16]]

        L = rgb2rgba(colors[0]) if transparency else colors[0]
        M = rgb2rgba(colors[1]) if transparency else colors[1]
        R = rgb2rgba(colors[2]) if transparency else colors[2]

        colors_joints = [M, R, R, R, L, L, L, M, M, M, M, L, L, L, R, R, R]
        colors_limbs = [R, R, R, L, L, L, M, M, M, L, R, M, L, L, R, R]
        
    else:
        raise ValueError("Only support number of joints be 49 or 17 or 15")

    if transparency:
        canvas = np.zeros(shape=(H, W, 4))
    else:
        canvas = np.ones(shape=(H, W, 3)) * np.array(bg_color).reshape([1, 1, 3])
    hips = joints_position[0]
    neck = joints_position[8]
    torso_length = ((hips[1] - neck[1]) ** 2 + (hips[0] - neck[0]) ** 2) ** 0.5
    head_radius = int(torso_length/4.5)
    end_effectors_radius = int(torso_length/15)
    end_effectors_radius = 7
    joints_radius = 7
    for i in range(0, len(colors_joints)):
        if i in (17, 18):
            continue
        elif i > 18:
            radius = 2
        else:
            radius = joints_radius
        if len(joints_position[i])==3:                 # If there is confidence, weigh by confidence
            weight = joints_position[i][2]
            if weight==0:
                continue
        cv2.circle(canvas, (int(joints_position[i][0]),int(joints_position[i][1])), radius, colors_joints[i], thickness=-1)
        
    stickwidth = 2
    for i in range(len(limbSeq)):
        limb = limbSeq[i]
        cur_canvas = canvas.copy()
        point1_index = limb[0]
        point2_index = limb[1]
        point1 = joints_position[point1_index]
        point2 = joints_position[point2_index]
        if len(point1)==3:                             # If there is confidence, weigh by confidence
            limb_weight = min(point1[2], point2[2])
            if limb_weight==0:
                bb = bounding_box(canvas)
                canvas_cropped = canvas[:,bb[2]:bb[3], :]
                continue
        X = [point1[1], point2[1]]
        Y = [point1[0], point2[0]]
        mX = np.mean(X)
        mY = np.mean(Y)
        length = ((X[0] - X[1]) ** 2 + (Y[0] - Y[1]) ** 2) ** 0.5
        alpha = math.degrees(math.atan2(X[0] - X[1], Y[0] - Y[1]))
        polygon = cv2.ellipse2Poly((int(mY), int(mX)), (int(length / 2), stickwidth), int(alpha), 0, 360, 1)
        cv2.fillConvexPoly(cur_canvas, polygon, colors_limbs[i])
        canvas = cv2.addWeighted(canvas, 0.4, cur_canvas, 0.6, 0)
        bb = bounding_box(canvas)
        canvas_cropped = canvas[:,bb[2]:bb[3], :]
    canvas = canvas.astype(imtype)
    canvas_cropped = canvas_cropped.astype(imtype)
    if grayscale:
        if transparency:
            canvas = cv2.cvtColor(canvas, cv2.COLOR_RGBA2GRAY)
            canvas_cropped = cv2.cvtColor(canvas_cropped, cv2.COLOR_RGBA2GRAY)
        else:
            canvas = cv2.cvtColor(canvas, cv2.COLOR_RGB2GRAY)
            canvas_cropped = cv2.cvtColor(canvas_cropped, cv2.COLOR_RGB2GRAY)
    return [canvas, canvas_cropped]

import numpy as np
import imageio
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from tqdm import tqdm
import io
import cv2

"""
Converts a Matplotlib figure to a NumPy array.

Args:
    fig (matplotlib.figure.Figure): The figure to convert.
    dpi (int): The resolution in dots per inch.

Returns:
    np.array: The image of the figure as a NumPy array.
"""
# You need a helper function to convert a Matplotlib figure to an image array.
# Make sure you have this function defined in your project.
def get_img_from_fig(fig, dpi=120):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi)
    buf.seek(0)
    img_arr = np.frombuffer(buf.getvalue(), dtype=np.uint8)
    buf.close()
    img = cv2.imdecode(img_arr, 1)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return img

def motion2video_3d(motion, save_path, fps=25, keep_imgs=False):
    """
    Generates a 3D stick figure video from motion data with an angle arc,
    including shoulder rotation arcs.

    Args:
        motion (np.array): Human motion data (17, 3, N) where 17 is the number of joints,
                           3 is (x, y, z) coordinates, and N is the number of frames.
        save_path (str): Path to save the output video (e.g., 'output.mp4').
        fps (int): Frames per second for the output video.
        keep_imgs (bool): Not used in the current implementation.
    """
    videowriter = imageio.get_writer(save_path, fps=fps)
    vlen = motion.shape[-1]

    joint_pairs = [
        [0, 1], [1, 2], [2, 3],    # Right leg
        [0, 4], [4, 5], [5, 6],    # Left leg
        [0, 7],                      # Pelvis to Spine1
        [7, 8],                      # Spine1 to Spine2
        [8, 9],                      # Spine2 to Neck
        [9, 10],                     # Neck to Head
        [8, 11], [11, 12], [12, 13], # Left arm
        [8, 14], [14, 15], [15, 16]  # Right arm
    ]

    joint_pairs_left_side = [[0, 4], [4, 5], [5, 6], [8, 11], [11, 12], [12, 13]]
    joint_pairs_right_side = [[0, 1], [1, 2], [2, 3], [8, 14], [14, 15], [15, 16]]

    special_joint_pair_1 = [
        [[14, 15], [15, 16]], # Right Elbow
        [[11, 12], [12, 13]], # Left Elbow
        [[1, 2], [2, 3]],     # Right Knee
        [[4, 5], [5, 6]]      # Left Knee
    ]
    color_mid = "#00457E"
    color_left = "#02315E"
    color_right = "#2F70AF"

    color_special_2 = "#C70039"
    color_special_3 = "#FF9100"
    color_special_4 = "#BBC715"
    color_special_5 = "#01FFC8"
    color_arc = "#00FF00"
    color_shoulder_left = "#FF5733"
    color_shoulder_right = "#C70039"

    initial_shoulder_positions = {11: None, 14: None}

    for f in tqdm(range(vlen)):
        j3d = motion[:, :, f]

        fig = plt.figure(0, figsize=(10, 10))
        ax = plt.axes(projection="3d")

        ax.set_xlim(-512, 0)
        ax.set_ylim(-256, 256)
        ax.set_zlim(-512, 0)

        ax.view_init(elev=12., azim=80)

        plt.tick_params(left=False, right=False, labelleft=False,
                        labelbottom=False, bottom=False)

        # Store initial shoulder positions on the first frame
        if f == 0:
            initial_shoulder_positions[11] = np.array([-j3d[11, 0], -j3d[11, 2], -j3d[11, 1]])
            initial_shoulder_positions[14] = np.array([-j3d[14, 0], -j3d[14, 2], -j3d[14, 1]])

        for i in range(len(joint_pairs)):
            limb = joint_pairs[i]
            xs, ys, zs = [np.array([j3d[limb[0], j], j3d[limb[1], j]]) for j in range(3)]
            x_plot, y_plot, z_plot = -xs, -zs, -ys

            line_color = color_mid
            if limb in joint_pairs_left_side:
                line_color = color_left
            elif limb in joint_pairs_right_side:
                line_color = color_right

            ax.plot(x_plot, y_plot, z_plot, color=line_color, lw=3, marker='o',
                    markerfacecolor='w', markersize=3, markeredgewidth=2)

        # --- Draw Arcs for Elbows and Knees ---
        for i in range(4):
            aa, bb, cc = special_joint_pair_1[i][0][0], special_joint_pair_1[i][0][1], special_joint_pair_1[i][1][1]
            joint_1_coord = np.array([-j3d[aa, 0], -j3d[aa, 2], -j3d[aa, 1]])
            joint_2_coord = np.array([-j3d[bb, 0], -j3d[bb, 2], -j3d[bb, 1]])
            joint_3_coord = np.array([-j3d[cc, 0], -j3d[cc, 2], -j3d[cc, 1]])

            vec1 = joint_1_coord - joint_2_coord
            vec2 = joint_3_coord - joint_2_coord
            
            epsilon = 1e-6
            vec1_norm = vec1 / (np.linalg.norm(vec1) + epsilon)
            vec2_norm = vec2 / (np.linalg.norm(vec2) + epsilon)
            
            dot_product = np.clip(np.dot(vec1_norm, vec2_norm), -1.0, 1.0)
            angle_rad = np.arccos(dot_product)
            angle_deg = np.degrees(angle_rad)

            ax.text(joint_2_coord[0], joint_2_coord[1], joint_2_coord[2] + 20,
                    f'{angle_deg:.1f}°', color='red', fontsize=10, ha='center', va='bottom')

            if angle_rad > 0.05:
                arc_radius = 30
                num_arc_points = 20
                t_values = np.linspace(0, 1, num_arc_points)
                arc_points = []
                for t in t_values:
                    term1 = np.sin((1 - t) * angle_rad) / np.sin(angle_rad)
                    term2 = np.sin(t * angle_rad) / np.sin(angle_rad)
                    interp_vec = term1 * vec1_norm + term2 * vec2_norm
                    arc_point = joint_2_coord + interp_vec * arc_radius
                    arc_points.append(arc_point)
                
                arc_points = np.array(arc_points)
                arc_color = color_arc
                if i == 0: arc_color = color_special_2
                elif i == 1: arc_color = color_special_3
                elif i == 2: arc_color = color_special_4
                elif i == 3: arc_color = color_special_5
                ax.plot(arc_points[:, 0], arc_points[:, 1], arc_points[:, 2], color=arc_color, lw=2.5)

        # <--- NEW CODE START: Drawing the Shoulder Rotation Arc ---
        shoulder_joints = [[14, 11],
                           [4,1]] # 11: Left Shoulder, 14: Right Shoulder
        center_joint_coord_list = [np.array([-j3d[8, 0], -j3d[8, 2], -j3d[8, 1]]),
                                   np.array([-j3d[0, 0], -j3d[0, 2], -j3d[0, 1]])]
        for index,i in enumerate(shoulder_joints):
            center_joint_coord = center_joint_coord_list[index]

            for shoulder_joint_idx in i:
                # Vector from center to initial shoulder position
                initial_vec = np.array([-motion[shoulder_joint_idx, 0 ,0], -motion[shoulder_joint_idx, 2 ,0], -motion[shoulder_joint_idx, 1 ,0]]) - center_joint_coord
                
                # Vector from center to current shoulder position
                current_shoulder_coord = np.array([-j3d[shoulder_joint_idx, 0], -j3d[shoulder_joint_idx, 2], -j3d[shoulder_joint_idx, 1]])
                current_vec = current_shoulder_coord - center_joint_coord

                epsilon = 1e-6
                initial_vec_norm = initial_vec / (np.linalg.norm(initial_vec) + epsilon)
                current_vec_norm = current_vec / (np.linalg.norm(current_vec) + epsilon)

                dot_product = np.clip(np.dot(initial_vec_norm, current_vec_norm), -1.0, 1.0)
                angle_rad = np.arccos(dot_product)

                ax.text(current_shoulder_coord[0], current_shoulder_coord[1], current_shoulder_coord[2] + 20,
                    f'{np.degrees(angle_rad):.1f}°', color='red', fontsize=10, ha='center', va='bottom')


                if angle_rad > 0.05: # Only draw if rotation is significant
                    arc_radius = 40 # A slightly larger radius for visibility
                    num_arc_points = 20
                    t_values = np.linspace(0, 1, num_arc_points)
                    arc_points = []
                    
                    # Use Slerp to draw the arc
                    for t in t_values:
                        term1 = np.sin((1 - t) * angle_rad) / np.sin(angle_rad)
                        term2 = np.sin(t * angle_rad) / np.sin(angle_rad)
                        interp_vec = term1 * initial_vec_norm + term2 * current_vec_norm
                        arc_point = center_joint_coord + interp_vec * arc_radius
                        arc_points.append(arc_point)

                    arc_points = np.array(arc_points)
                    arc_color = "#C0DA2F"  # Use a bright color like lime green for the arc
                    ax.plot(arc_points[:, 0], arc_points[:, 1], arc_points[:, 2], color=arc_color, lw=2.5)
        # <--- NEW CODE END ---

        # <--- UPDATED: Added elbow labels to the top right corner --->
        ax.text2D(0.95, 0.95, "right elbow",
                  transform=ax.transAxes, ha="right", va="top",
                  color=color_special_3, fontsize=13,
                  bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
        ax.text2D(0.95, 0.90, "left elbow",
                  transform=ax.transAxes, ha="right", va="top",
                  color=color_special_2, fontsize=13,
                  bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
        ax.text2D(0.95, 0.85, "right knee",
                  transform=ax.transAxes, ha="right", va="top",
                  color=color_special_4, fontsize=13,
                  bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
        ax.text2D(0.95, 0.80, "left knee",
                  transform=ax.transAxes, ha="right", va="top",
                  color=color_special_5, fontsize=13,
                  bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
        # <--- NEW CODE END ---

        frame_vis = get_img_from_fig(fig)
        videowriter.append_data(frame_vis)
        plt.close(fig)

    videowriter.close()
    print(f"Video saved to {save_path}")


# def motion2video_3d(motion, save_path, fps=25, keep_imgs=False):
#     """
#     Generates a 3D stick figure video from motion data with an angle arc.

#     Args:
#         motion (np.array): Human motion data (17, 3, N) where 17 is the number of joints,
#                              3 is (x, y, z) coordinates, and N is the number of frames.
#         save_path (str): Path to save the output video (e.g., 'output.mp4').
#         fps (int): Frames per second for the output video.
#         keep_imgs (bool): Not used in the current implementation.
#     """
#     videowriter = imageio.get_writer(save_path, fps=fps)
#     vlen = motion.shape[-1]
    
#     joint_pairs = [
#         [0, 1], [1, 2], [2, 3],   # Right leg
#         [0, 4], [4, 5], [5, 6],   # Left leg
#         [0, 7],                   # Pelvis to Spine1
#         [7, 8],                   # Spine1 to Spine2
#         [8, 9],                   # Spine2 to Neck
#         [9, 10],                  # Neck to Head
#         [8, 11], [11, 12], [12, 13], # Left arm
#         [8, 14], [14, 15], [15, 16]  # Right arm
#     ]

#     joint_pairs_left_side = [[0, 4], [4, 5], [5, 6], [8, 11], [11, 12], [12, 13]]
#     joint_pairs_right_side = [[0, 1], [1, 2], [2, 3], [8, 14], [14, 15], [15, 16]]
    
#     special_joint_pair_1 = [[[14, 15],[15,16]], # Right Shoulder to Right Elbow
#                             [[11, 12],[12,13]],
#                             [[1, 2],[2, 3]],
#                             [[4, 5],[5, 6]]] # Left Shoulder to Left Elbow,
#                             # [[8, 14],[14, 15]],
#                             # [[8, 11],[11, 12]]
#     color_mid = "#00457E"
#     color_left = "#02315E"
#     color_right = "#2F70AF"

#     color_special_2 = "#C70039"
#     color_special_3 = "#FF9100" # Optional, not used in this code
#     color_special_4 = "#BBC715" # Optional, not used in this code
#     color_special_5 = "#01FFC8" # Optional, not used in this code
#     color_arc = "#00FF00" # Use a bright color like lime green for the arc

#     for f in tqdm(range(vlen)):
#         j3d = motion[:, :, f]

#         fig = plt.figure(0, figsize=(10, 10))
#         ax = plt.axes(projection="3d")
        
#         ax.set_xlim(-512, 0)
#         ax.set_ylim(-256, 256)
#         ax.set_zlim(-512, 0)
        
#         ax.view_init(elev=12., azim=80)
        
#         plt.tick_params(left=False, right=False, labelleft=False,
#                         labelbottom=False, bottom=False)

#         for i in range(len(joint_pairs)):
#             limb = joint_pairs[i]
#             xs, ys, zs = [np.array([j3d[limb[0], j], j3d[limb[1], j]]) for j in range(3)]
#             x_plot, y_plot, z_plot = -xs, -zs, -ys

#             line_color = color_mid
#             if limb in special_joint_pair_1[0]:
#                 line_color = color_special_2
#             elif limb in special_joint_pair_1[1]:
#                 line_color = color_special_3
#             elif limb in special_joint_pair_1[2]:
#                 line_color = color_special_4
#             elif limb in special_joint_pair_1[3]:
#                 line_color = color_special_5
#             elif limb in joint_pairs_left_side:
#                 line_color = color_left
#             elif limb in joint_pairs_right_side:
#                 line_color = color_right
            
#             ax.plot(x_plot, y_plot, z_plot, color=line_color, lw=3, marker='o', 
#                     markerfacecolor='w', markersize=3, markeredgewidth=2)
            
#         for i in range(4):
#             aa,bb,cc = special_joint_pair_1[i][0][0], special_joint_pair_1[i][0][1], special_joint_pair_1[i][1][1]
#             # --- Angle Calculation and Annotation ---
#             joint_14_coord_transformed = np.array([-j3d[aa, 0], -j3d[aa, 2], -j3d[aa, 1]])
#             joint_15_coord_transformed = np.array([-j3d[bb, 0], -j3d[bb, 2], -j3d[bb, 1]])
#             joint_16_coord_transformed = np.array([-j3d[cc, 0], -j3d[cc, 2], -j3d[cc, 1]])
#             vec_15_14 = joint_14_coord_transformed - joint_15_coord_transformed
#             vec_15_16 = joint_16_coord_transformed - joint_15_coord_transformed

#             epsilon = 1e-6
#             vec_15_14_norm = vec_15_14 / (np.linalg.norm(vec_15_14) + epsilon)
#             vec_15_16_norm = vec_15_16 / (np.linalg.norm(vec_15_16) + epsilon)

#             dot_product = np.clip(np.dot(vec_15_14_norm, vec_15_16_norm), -1.0, 1.0) 
            
#             angle_rad = np.arccos(dot_product)
#             angle_deg = np.degrees(angle_rad)

#             ax.text(joint_15_coord_transformed[0], 
#                     joint_15_coord_transformed[1], 
#                     joint_15_coord_transformed[2] + 20,
#                     f'{angle_deg:.1f}°', color='red', fontsize=10, ha='center', va='bottom')

#             # <--- NEW CODE START: Drawing the Arc ---
            
#             # Only draw the arc if the angle is significant (to avoid visual clutter and division by zero)
#             if angle_rad > 0.05: # approx 3 degrees
                
#                 arc_radius = 30  # Adjust the radius of the arc as needed
#                 num_arc_points = 20 # Number of points to define the arc's curve

#                 # Generate points for the arc using Slerp
#                 arc_points = []
#                 # `t` goes from 0 to 1 to interpolate between the two vectors
#                 t_values = np.linspace(0, 1, num_arc_points)
                
#                 # The Slerp formula: P(t) = (sin((1-t)Ω)/sin(Ω)) * v1 + (sin(tΩ)/sin(Ω)) * v2
#                 # where Ω is the angle between vectors v1 and v2.
#                 for t in t_values:
#                     # We use the normalized vectors for direction
#                     term1 = np.sin((1 - t) * angle_rad) / np.sin(angle_rad)
#                     term2 = np.sin(t * angle_rad) / np.sin(angle_rad)
                    
#                     # Interpolate the direction vector
#                     interp_vec = term1 * vec_15_14_norm + term2 * vec_15_16_norm
                    
#                     # Scale by radius and add the origin point (the elbow joint)
#                     arc_point = joint_15_coord_transformed + interp_vec * arc_radius
#                     arc_points.append(arc_point)

#                 # Convert list of points to a NumPy array for easier indexing
#                 arc_points = np.array(arc_points)
#                 if i == 4:
#                     color_arcc = "#849C00"
#                 elif i == 5:
#                     color_arcc = "#3C7F2E"
#                 else:
#                     color_arcc = color_arc
#                 # Plot the arc
#                 ax.plot(arc_points[:, 0], arc_points[:, 1], arc_points[:, 2], 
#                         color=color_arcc, lw=2.5)
#         # <--- NEW CODE START: Add elbow labels to the top right corner --->
#         ax.text2D(0.95, 0.95, "right elbow",
#                 transform=ax.transAxes, ha="right", va="top",
#                 color=color_special_3, fontsize=13,
#                 bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
#         ax.text2D(0.95, 0.90, "left  elbow",
#                 transform=ax.transAxes, ha="right", va="top",
#                 color=color_special_2, fontsize=13,
#                 bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
#         ax.text2D(0.95, 0.85, "right  leg",
#                 transform=ax.transAxes, ha="right", va="top",
#                 color=color_special_4, fontsize=13,
#                 bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
#         ax.text2D(0.95, 0.80, "left   leg",
#                 transform=ax.transAxes, ha="right", va="top",
#                 color=color_special_5, fontsize=13,
#                 bbox=dict(facecolor='white', alpha=0.8, edgecolor='none'))
#         # <--- NEW CODE END ---

#         # Convert the current Matplotlib figure to an image array
#         # You need a working get_img_from_fig function for this part
#         # Make sure to import necessary libraries like io and cv2 for the helper function
#         frame_vis = get_img_from_fig(fig) 
#         videowriter.append_data(frame_vis)
#         plt.close(fig) 

#     videowriter.close()
#     print(f"Video saved to {save_path}")

def motion2video_mesh(motion, save_path, fps=25, keep_imgs = False, draw_face=True):
    videowriter = imageio.get_writer(save_path, fps=fps)
    vlen = motion.shape[-1]
    draw_skele = (motion.shape[0]==17)
    save_name = save_path.split('.')[0]
    smpl_faces = get_smpl_faces()
    frames = []
    joint_pairs = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [0, 7], [7, 8], [8, 9], [8, 11], [8, 14], [9, 10], [11, 12], [12, 13], [14, 15], [15, 16]]

    
    X, Y, Z = motion[:, 0], motion[:, 1], motion[:, 2]
    max_range = np.array([X.max()-X.min(), Y.max()-Y.min(), Z.max()-Z.min()]).max() / 2.0
    mid_x = (X.max()+X.min()) * 0.5
    mid_y = (Y.max()+Y.min()) * 0.5
    mid_z = (Z.max()+Z.min()) * 0.5
    
    for f in tqdm(range(vlen)):
        j3d = motion[:,:,f]
        plt.gca().set_axis_off()
        plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
        plt.gca().xaxis.set_major_locator(plt.NullLocator())
        plt.gca().yaxis.set_major_locator(plt.NullLocator())
        fig = plt.figure(0, figsize=(8, 8))
        ax = plt.axes(projection="3d", proj_type = 'ortho')
        ax.set_xlim(mid_x - max_range, mid_x + max_range)
        ax.set_ylim(mid_y - max_range, mid_y + max_range)
        ax.set_zlim(mid_z - max_range, mid_z + max_range)
        ax.view_init(elev=-90, azim=-90)
        plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
        plt.margins(0, 0, 0)
        plt.gca().xaxis.set_major_locator(plt.NullLocator())
        plt.gca().yaxis.set_major_locator(plt.NullLocator())
        plt.axis('off')
        plt.xticks([])
        plt.yticks([])
        
        # plt.savefig("filename.png", transparent=True, bbox_inches="tight", pad_inches=0)
        
        if draw_skele:
            for i in range(len(joint_pairs)):
                limb = joint_pairs[i]
                xs, ys, zs = [np.array([j3d[limb[0], j], j3d[limb[1], j]]) for j in range(3)]
                ax.plot(-xs, -zs, -ys, c=[0,0,0], lw=3, marker='o', markerfacecolor='w', markersize=3, markeredgewidth=2) # axis transformation for visualization
        elif draw_face:
            ax.plot_trisurf(j3d[:, 0], j3d[:, 1], triangles=smpl_faces, Z=j3d[:, 2], color=(166/255.0,188/255.0,218/255.0,0.9))
        else:
            ax.scatter(j3d[:, 0], j3d[:, 1], j3d[:, 2], s=3, c='w', edgecolors='grey')
        frame_vis = get_img_from_fig(fig, dpi=128)
        plt.cla()
        videowriter.append_data(frame_vis)
        plt.close()
    videowriter.close()

def save_image(image_numpy, image_path):
    image_pil = Image.fromarray(image_numpy)
    image_pil.save(image_path)

def bounding_box(img):
    a = np.where(img != 0)
    bbox = np.min(a[0]), np.max(a[0]), np.min(a[1]), np.max(a[1])
    return bbox
