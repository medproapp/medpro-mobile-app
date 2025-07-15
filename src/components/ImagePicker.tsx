import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { theme } from '@theme/index';

const { width: screenWidth } = Dimensions.get('window');

interface ImagePickerProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (imageUri: string, fileName: string) => void;
  onUploadComplete?: (success: boolean) => void;
}

interface SelectedImage {
  uri: string;
  fileName: string;
  fileSize?: number;
}

export const ImagePickerComponent: React.FC<ImagePickerProps> = ({
  visible,
  onClose,
  onImageSelected,
  onUploadComplete,
}) => {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return {
      camera: cameraPermission.status === 'granted',
      mediaLibrary: mediaLibraryPermission.status === 'granted',
    };
  };

  const showImageOptions = () => {
    Alert.alert(
      'Selecionar Imagem',
      'Escolha uma opção para adicionar a imagem',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Câmera', onPress: takePhoto },
        { text: 'Galeria', onPress: pickFromGallery },
      ]
    );
  };

  const takePhoto = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.camera) {
      Alert.alert(
        'Permissão necessária',
        'Este aplicativo precisa de permissão para acessar a câmera.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        setSelectedImage({
          uri: image.uri,
          fileName: `camera_${Date.now()}.jpg`,
          fileSize: image.fileSize,
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Erro', 'Não foi possível capturar a foto.');
    }
  };

  const pickFromGallery = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.mediaLibrary) {
      Alert.alert(
        'Permissão necessária',
        'Este aplicativo precisa de permissão para acessar suas fotos.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        const fileName = image.fileName || `image_${Date.now()}.jpg`;
        
        setSelectedImage({
          uri: image.uri,
          fileName,
          fileSize: image.fileSize,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const removeImage = () => {
    Alert.alert(
      'Remover imagem',
      'Tem certeza que deseja remover a imagem selecionada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => setSelectedImage(null),
        },
      ]
    );
  };

  const uploadImage = async () => {
    if (!selectedImage) {
      Alert.alert('Erro', 'Nenhuma imagem selecionada.');
      return;
    }

    try {
      setIsUploading(true);
      
      // Call the parent component's callback
      onImageSelected(selectedImage.uri, selectedImage.fileName);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsUploading(false);
      onUploadComplete?.(true);
      
      Alert.alert(
        'Sucesso',
        'Imagem enviada com sucesso!',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Error uploading image:', error);
      setIsUploading(false);
      onUploadComplete?.(false);
      Alert.alert('Erro', 'Não foi possível enviar a imagem.');
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    onClose();
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return 'Tamanho desconhecido';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome name="times" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Adicionar Imagem</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {!selectedImage ? (
              // Image selection
              <View style={styles.selectionContainer}>
                <View style={styles.iconContainer}>
                  <FontAwesome name="camera" size={48} color={theme.colors.primary} />
                </View>
                
                <Text style={styles.instructionText}>
                  Adicione uma imagem ao encontro
                </Text>
                
                <Text style={styles.supportedFormats}>
                  Capture uma foto ou selecione da galeria
                </Text>

                <TouchableOpacity style={styles.selectButton} onPress={showImageOptions}>
                  <FontAwesome name="image" size={20} color={theme.colors.white} />
                  <Text style={styles.selectButtonText}>Selecionar Imagem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Image preview
              <View style={styles.previewContainer}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                  <TouchableOpacity onPress={removeImage} style={styles.removeImageButton}>
                    <FontAwesome name="times" size={16} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.imageInfo}>
                  <Text style={styles.imageName} numberOfLines={1}>
                    {selectedImage.fileName}
                  </Text>
                  <Text style={styles.imageSize}>
                    {formatFileSize(selectedImage.fileSize)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {selectedImage && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                onPress={uploadImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.uploadButtonText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    marginBottom: 20,
  },
  selectionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  instructionText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  supportedFormats: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  selectButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.45,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  imageName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  imageSize: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  uploadButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});