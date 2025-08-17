import json
import ast
from PIL import Image
import google.generativeai as genai
from constants import GEMINI_API_KEY

# Configure Gemini API
genai.configure(api_key=GEMINI_API_KEY)

def _extract_text_from_gemini_response(response) -> str:
    """
    Safely extract concatenated text from a Gemini response.
    """
    try:
        if hasattr(response, 'text') and response.text:
            return response.text
        
        if hasattr(response, 'parts'):
            parts = response.parts
            text_parts = [part.text for part in parts if hasattr(part, 'text') and part.text]
            if text_parts:
                return "".join(text_parts)
        
        if hasattr(response, 'candidates'):
            for candidate in response.candidates:
                if hasattr(candidate, 'content'):
                    content = candidate.content
                    if hasattr(content, 'parts'):
                        text_parts = [part.text for part in content.parts if hasattr(part, 'text') and part.text]
                        if text_parts:
                            return "".join(text_parts)
                            
        if hasattr(response, 'content'):
            content = response.content
            if hasattr(content, 'parts'):
                parts = content.parts
                text_parts = []
                for part in parts:
                    if hasattr(part, 'text') and part.text:
                        text_parts.append(part.text)
                if text_parts:
                    result = "".join(text_parts)
                    return result
        
        # Try string representation if all else fails
        response_str = str(response)
        if response_str and response_str != str(type(response)):
            return response_str
            
    except Exception as e:
        print(f"Error extracting text from response: {e}")
    
    return ""

def analyze_image(img: Image, dict_of_vars: dict = None, subject: str = "math") -> list:
    """
    Analyze a mathematical expression in an image and return step-by-step solution.
    
    Args:
        img: PIL Image object containing the mathematical expression
        dict_of_vars: Dictionary of variable values (optional)
        subject: Subject area (math, physics, chemistry, etc.)
    
    Returns:
        List of dictionaries containing solutions
    """
    # Initialize Gemini model
    model = genai.GenerativeModel(model_name="gemini-2.5-flash")
    dict_of_vars_str = json.dumps(dict_of_vars, ensure_ascii=False) if dict_of_vars else "{}"
    
    # Base prompt for all subjects
    base_prompt = (
        f"You have been given an image with some expressions, equations, or problems related to {subject}, and you need to solve them. "
        f"Note: Use the PEMDAS rule for solving mathematical expressions. PEMDAS stands for the Priority Order: Parentheses, Exponents, Multiplication and Division (from left to right), Addition and Subtraction (from left to right). "
        f"Here is a dictionary of user-assigned variables. If the given expression has any of these variables, use its actual value from this dictionary accordingly: {dict_of_vars_str}. "
        f"CRITICAL: Return ONLY valid Python literal syntax that can be parsed by ast.literal_eval(). "
        f"DO NOT use backticks, markdown formatting, or any other text. "
        f"DO NOT include language identifiers like 'python' or 'json'. "
        f"Example valid response: [{{'expr': '2 + 3', 'result': 5}}]"
    )
    
    # Subject-specific prompts
    if subject == "math":
        subject_prompt = (
            f"YOU CAN HAVE FIVE TYPES OF EQUATIONS/EXPRESSIONS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: "
            f"Following are the cases: "
            f"1. Simple mathematical expressions like 2 + 2, 3 * 4, 5 / 6, 7 - 8, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"2. Set of Equations like x^2 + 2x + 1 = 0, 3y + 4x = 0, 5x^2 + 6y + 7 = 12, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {{'expr': 'x', 'result': 2, 'assign': True}} and dict 2 as {{'expr': 'y', 'result': 5, 'assign': True}}. This example assumes x was calculated as 2, and y as 5. Include as many dicts as there are variables. "
            f"3. Assigning values to variables like x = 4, y = 5, z = 6, etc.: In this case, assign values to variables and return another key in the dict called {{'assign': True}}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. "
            f"4. Analyzing Graphical Math problems, which are word problems represented in drawing form, such as cars colliding, trigonometric problems, problems on the Pythagorean theorem, adding runs from a cricket wagon wheel, etc. These will have a drawing representing some scenario and accompanying information with the image. PAY CLOSE ATTENTION TO DIFFERENT COLORS FOR THESE PROBLEMS. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"5. Detecting Abstract Concepts that a drawing might show, such as love, hate, jealousy, patriotism, or a historic reference to war, invention, discovery, quote, etc. USE THE SAME FORMAT AS OTHERS TO RETURN THE ANSWER, where 'expr' will be the explanation of the drawing, and 'result' will be the abstract concept. "
        )
    elif subject == "physics":
        subject_prompt = (
            f"YOU CAN HAVE FIVE TYPES OF PHYSICS PROBLEMS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: "
            f"Following are the cases: "
            f"1. Simple physics calculations like F = ma, E = mc², v = d/t, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"2. Set of Physics Equations with multiple variables like F = ma, v = u + at, s = ut + ½at², etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {{'expr': 'F', 'result': 50, 'assign': True}} and dict 2 as {{'expr': 'a', 'result': 5, 'assign': True}}. Include as many dicts as there are variables. "
            f"3. Assigning values to physics variables like m = 10 kg, v = 20 m/s, t = 5 s, etc.: In this case, assign values to variables and return another key in the dict called {{'assign': True}}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. "
            f"4. Analyzing Physics Diagrams like free body diagrams, circuit diagrams, ray diagrams, etc. These will have drawings representing physical scenarios with accompanying information. PAY CLOSE ATTENTION TO DIFFERENT COLORS AND LABELS. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"5. Physics Word Problems represented in drawing form, such as projectile motion, collisions, electrical circuits, etc. These will have a drawing representing some physical scenario and accompanying information. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
        )
    elif subject == "chemistry":
        subject_prompt = (
            f"YOU CAN HAVE FIVE TYPES OF CHEMISTRY PROBLEMS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: "
            f"Following are the cases: "
            f"1. Simple chemistry calculations like n = m/M, c = n/V, pH = -log[H+], etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"2. Set of Chemistry Equations with multiple variables like PV = nRT, c₁V₁ = c₂V₂, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {{'expr': 'n', 'result': 2.5, 'assign': True}} and dict 2 as {{'expr': 'V', 'result': 0.5, 'assign': True}}. Include as many dicts as there are variables. "
            f"3. Assigning values to chemistry variables like m = 50 g, M = 18 g/mol, V = 100 mL, etc.: In this case, assign values to variables and return another key in the dict called {{'assign': True}}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. "
            f"4. Analyzing Chemistry Diagrams like molecular structures, chemical equations, titration curves, etc. These will have drawings representing chemical scenarios with accompanying information. PAY CLOSE ATTENTION TO DIFFERENT COLORS, SYMBOLS, AND LABELS. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"5. Chemistry Word Problems represented in drawing form, such as stoichiometry, acid-base reactions, gas laws, etc. These will have a drawing representing some chemical scenario and accompanying information. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
        )
    elif subject == "science":
        subject_prompt = (
            f"YOU CAN HAVE FIVE TYPES OF GENERAL SCIENCE PROBLEMS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: "
            f"Following are the cases: "
            f"1. Simple science calculations like density = mass/volume, speed = distance/time, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"2. Set of Science Equations with multiple variables like P = F/A, E = mgh, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {{'expr': 'P', 'result': 1000, 'assign': True}} and dict 2 as {{'expr': 'F', 'result': 5000, 'assign': True}}. Include as many dicts as there are variables. "
            f"3. Assigning values to science variables like m = 100 kg, h = 10 m, g = 9.8 m/s², etc.: In this case, assign values to variables and return another key in the dict called {{'assign': True}}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. "
            f"4. Analyzing Science Diagrams like food webs, water cycles, cell structures, etc. These will have drawings representing scientific concepts with accompanying information. PAY CLOSE ATTENTION TO DIFFERENT COLORS, LABELS, AND ARROWS. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"5. Science Word Problems represented in drawing form, such as ecosystem interactions, geological processes, biological systems, etc. These will have a drawing representing some scientific scenario and accompanying information. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
        )
    else:
        # Default to math if subject is not recognized
        subject_prompt = (
            f"YOU CAN HAVE FIVE TYPES OF EQUATIONS/EXPRESSIONS IN THIS IMAGE, AND ONLY ONE CASE SHALL APPLY EVERY TIME: "
            f"Following are the cases: "
            f"1. Simple mathematical expressions like 2 + 2, 3 * 4, 5 / 6, 7 - 8, etc.: In this case, solve and return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"2. Set of Equations like x^2 + 2x + 1 = 0, 3y + 4x = 0, 5x^2 + 6y + 7 = 12, etc.: In this case, solve for the given variable, and the format should be a COMMA SEPARATED LIST OF DICTS, with dict 1 as {{'expr': 'x', 'result': 2, 'assign': True}} and dict 2 as {{'expr': 'y', 'result': 5, 'assign': True}}. This example assumes x was calculated as 2, and y as 5. Include as many dicts as there are variables. "
            f"3. Assigning values to variables like x = 4, y = 5, z = 6, etc.: In this case, assign values to variables and return another key in the dict called {{'assign': True}}, keeping the variable as 'expr' and the value as 'result' in the original dictionary. RETURN AS A LIST OF DICTS. "
            f"4. Analyzing Graphical Math problems, which are word problems represented in drawing form, such as cars colliding, trigonometric problems, problems on the Pythagorean theorem, adding runs from a cricket wagon wheel, etc. These will have a drawing representing some scenario and accompanying information with the image. PAY CLOSE ATTENTION TO DIFFERENT COLORS FOR THESE PROBLEMS. You need to return the answer in the format of a LIST OF ONE DICT [{{'expr': 'given expression', 'result': 'calculated answer'}}]. "
            f"5. Detecting Abstract Concepts that a drawing might show, such as love, hate, jealousy, patriotism, or a historic reference to war, invention, discovery, quote, etc. USE THE SAME FORMAT AS OTHERS TO RETURN THE ANSWER, where 'expr' will be the explanation of the drawing, and 'result' will be the abstract concept. "
        )
    
    prompt = base_prompt + subject_prompt + f"Analyze the equation or expression in this image and return the answer according to the given rules: Make sure to use extra backslashes for escape characters like \\f -> \\\\f, \\n -> \\\\n, etc. "
    
    print(f"Sending prompt to Gemini for subject: {subject}")
    print(f"Prompt length: {len(prompt)} characters")
    
    try:
        response = model.generate_content([prompt, img])
        
        print(f"Gemini response received: {type(response)}")
        print(f"Response finish reason: {getattr(response, 'finish_reason', 'N/A')}")
        
        response_text = _extract_text_from_gemini_response(response)
        
        if not response_text:
            # Log helpful debugging info without triggering response.text errors
            try:
                candidate_reasons = [getattr(c, "finish_reason", None) for c in getattr(response, "candidates", []) or []]
            except Exception:
                candidate_reasons = []
            print("Gemini returned no text. Candidate finish_reasons:", candidate_reasons)
            return []
            
        print("Raw Gemini response text:", response_text)
        answers = []
        
        # First, try to clean up the response text
        cleaned_text = response_text.strip()
        
        # Remove markdown code blocks completely
        if cleaned_text.startswith('```'):
            # Find the first and last ```
            first_backticks = cleaned_text.find('```')
            last_backticks = cleaned_text.rfind('```')
            
            if first_backticks != -1 and last_backticks != -1 and first_backticks != last_backticks:
                # Extract content between backticks
                cleaned_text = cleaned_text[first_backticks + 3:last_backticks].strip()
                
                # Remove language identifier if present (e.g., "python", "json")
                lines = cleaned_text.split('\n')
                if lines[0].strip() in ['python', 'json', 'javascript', 'js']:
                    cleaned_text = '\n'.join(lines[1:]).strip()
        
        print("Cleaned text:", cleaned_text)
        
        # Try multiple parsing approaches
        parsing_successful = False
        
        # Method 1: Try json.loads on cleaned text (most reliable for JSON)
        try:
            answers = json.loads(cleaned_text)
            print("Successfully parsed with json.loads")
            parsing_successful = True
        except Exception as json_error:
            print(f"JSON parsing failed: {json_error}")
        
        # Method 2: Try ast.literal_eval on cleaned text
        if not parsing_successful:
            try:
                answers = ast.literal_eval(cleaned_text)
                print("Successfully parsed with ast.literal_eval")
                parsing_successful = True
            except Exception as ast_error:
                print(f"ast.literal_eval failed: {ast_error}")
        
        # Method 3: Try json.loads on original text
        if not parsing_successful:
            try:
                answers = json.loads(response_text)
                print("Successfully parsed original text with json.loads")
                parsing_successful = True
            except Exception as json_error2:
                print(f"JSON parsing of original text failed: {json_error2}")
        
        # Method 4: Try ast.literal_eval on original text
        if not parsing_successful:
            try:
                answers = ast.literal_eval(response_text)
                print("Successfully parsed original text with ast.literal_eval")
                parsing_successful = True
            except Exception as ast_error2:
                print(f"ast.literal_eval of original text failed: {ast_error2}")
        
        # Method 5: Last resort - try to find and parse patterns with regex
        if not parsing_successful:
            try:
                import re
                # Look for patterns like [{'expr': '...', 'result': '...'}]
                pattern = r'\[\s*\{[^}]*\}\s*\]'
                matches = re.findall(pattern, response_text)
                if matches:
                    print("Found pattern with regex:", matches[0])
                    try:
                        answers = json.loads(matches[0])
                        print("Successfully parsed regex match with json.loads")
                        parsing_successful = True
                    except Exception as regex_json_error:
                        print(f"JSON parsing of regex match failed: {regex_json_error}")
                        try:
                            answers = ast.literal_eval(matches[0])
                            print("Successfully parsed regex match with ast.literal_eval")
                            parsing_successful = True
                        except Exception as regex_ast_error:
                            print(f"ast.literal_eval of regex match failed: {regex_ast_error}")
                else:
                    print("No valid patterns found with regex")
            except Exception as regex_error:
                print(f"Regex pattern matching failed: {regex_error}")
        
        if not parsing_successful:
            print("All parsing attempts failed")
            return []
        
        print('Parsed answers:', answers)
        
        # Ensure answers is a list
        if not isinstance(answers, list):
            answers = [answers]
        
        # Process each answer
        for answer in answers:
            if isinstance(answer, dict):
                if 'assign' not in answer:
                    answer['assign'] = False
            else:
                print(f"Warning: answer is not a dict: {answer}")
        
        return answers
        
    except Exception as e:
        print(f"Error in analyze_image: {e}")
        return [{
            "expr": "Error",
            "result": str(e),
            "assign": False
        }]
